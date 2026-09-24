import { withSupabase } from 'npm:@supabase/server@^1';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

    let body: { action?: string; familyId?: string; memberId?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const userId = ctx.userClaims?.sub;
    const userEmail = String(ctx.userClaims?.email ?? '').trim().toLowerCase();
    if (!userId) return json({ error: 'Authentication required.' }, 401);

    if (body.action === 'send') {
      if (!body.familyId || !body.memberId) return json({ error: 'Family and member are required.' }, 400);

      const { data: member, error: memberError } = await ctx.supabase
        .from('family_members')
        .select('id,family_id,email,name,is_active,user_id')
        .eq('id', body.memberId)
        .eq('family_id', body.familyId)
        .maybeSingle();

      if (memberError) return json({ error: memberError.message }, 400);
      if (!member) return json({ error: 'Member not found or you do not have access to this family.' }, 404);
      if (!member.is_active) return json({ error: 'Archived members cannot be invited.' }, 400);
      if (!member.email) return json({ error: 'Add an email address before sending an invitation.' }, 400);
      if (member.user_id) return json({ error: 'This member already has a Ledgerly account linked.' }, 400);

      const { data: family, error: familyError } = await ctx.supabase
        .from('families')
        .select('id,name')
        .eq('id', body.familyId)
        .maybeSingle();

      if (familyError) return json({ error: familyError.message }, 400);
      if (!family) return json({ error: 'Family not found.' }, 404);

      const siteUrl = Deno.env.get('LEDGERLY_SITE_URL') || 'https://ledgerly-family-expense-manager-fixed-622n7fhnc.vercel.app';
      const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(
        String(member.email).trim(),
        {
          data: {
            ledgerly_family_id: member.family_id,
            ledgerly_member_id: member.id,
            ledgerly_family_name: family.name,
            ledgerly_member_name: member.name,
          },
          redirectTo: siteUrl,
        },
      );

      if (inviteError) {
        const message = inviteError.message || 'Could not send the invitation.';
        if (/already.*registered|already.*exists|already.*confirmed/i.test(message)) {
          return json({
            error: 'This email already has a confirmed Ledgerly account. Ask them to sign in and join the family with the family code.',
            code: 'USER_ALREADY_REGISTERED',
          }, 409);
        }
        return json({ error: message }, 400);
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from('family_members')
        .update({ invited_at: new Date().toISOString() })
        .eq('id', member.id)
        .eq('family_id', member.family_id);

      if (updateError) return json({ error: updateError.message }, 400);
      return json({ ok: true, userId: invited?.user?.id ?? null });
    }

    if (body.action === 'accept') {
      if (!body.memberId) return json({ error: 'Member is required.' }, 400);
      if (!userEmail) return json({ error: 'Your account does not have a verified email address.' }, 400);

      const { data: member, error: memberError } = await ctx.supabaseAdmin
        .from('family_members')
        .select('id,family_id,email,user_id')
        .eq('id', body.memberId)
        .maybeSingle();

      if (memberError) return json({ error: memberError.message }, 400);
      if (!member) return json({ error: 'Invitation member record not found.' }, 404);
      if (String(member.email ?? '').trim().toLowerCase() !== userEmail) {
        return json({ error: 'This invitation does not belong to your signed-in email address.' }, 403);
      }
      if (member.user_id && member.user_id !== userId) {
        return json({ error: 'This family member is already linked to another account.' }, 409);
      }

      const { error: linkError } = await ctx.supabaseAdmin
        .from('family_members')
        .update({ user_id: userId, is_active: true })
        .eq('id', member.id);

      if (linkError) return json({ error: linkError.message }, 400);
      return json({ ok: true, familyId: member.family_id });
    }

    return json({ error: 'Unsupported invitation action.' }, 400);
  }),
};
