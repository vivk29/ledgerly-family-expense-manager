# Ledgerly — Supabase Family Invitation Research & Solution Report

Date: 2026-10-04

## 1. Executive conclusion

The earlier statement that Supabase cannot send a family invitation was **too broad**.

Supabase Auth absolutely supports invitation emails. The official Admin API provides `supabase.auth.admin.inviteUserByEmail()`, which sends the configured **Invite user** email template to a user who does not already exist. This operation must run in a trusted server environment with the Supabase secret/service key; it must never run in the browser.

Official references:
- https://supabase.com/docs/guides/auth/users
- https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail
- https://supabase.com/docs/reference/javascript/auth-admin-generatelink

The important limitation is that **an existing confirmed Auth user cannot be invited again with `inviteUserByEmail()`**. Supabase documents that inviting an email that already belongs to a confirmed user returns an error.

Therefore Ledgerly needs two related flows:

1. **New person / no Auth account** → Supabase `inviteUserByEmail()` → Invite User email.
2. **Existing Ledgerly account** → send a sign-in/magic link that carries the Ledgerly family-member context, or use a custom family-invitation email provider flow.

That is why the current Ledgerly implementation has a branch for existing accounts.

## 2. What I found in the current Ledgerly implementation

The repository already contains a protected Supabase Edge Function:

- Function: `family-invitation`
- JWT verification: enabled
- Current deployed version: 6

The function:
- verifies the caller,
- checks the family member belongs to the requested family,
- requires an active member and email,
- prevents duplicate email entries in the same family,
- checks whether the email already has a Supabase Auth account,
- uses `auth.admin.inviteUserByEmail()` for a new account,
- returns an `existingAccount` response for an existing Auth account.

The browser then handles the existing-account branch with `signInWithOtp()` and a Ledgerly `invite_member_id` redirect.

So the existing architecture is not fundamentally wrong. It is already following the correct security boundary: the privileged Admin API is kept server-side.

## 3. Why the earlier confusion happened

There are two different concepts:

### A. Supabase Auth invitation

`inviteUserByEmail()` is a real Supabase feature.

It creates an unconfirmed Auth user and sends the **Invite User** template.

### B. Inviting someone who already has an account

Supabase does not treat this as a second account invitation. The official documentation says an invitation to an email that already belongs to a confirmed user returns an error.

For that person, Ledgerly should not attempt to create another Auth identity.

Instead, Ledgerly can authenticate the existing account and then attach that account to the pending family-member record.

## 4. Email delivery is a separate issue

Even though Supabase supports invitation emails, the default Supabase email provider is intentionally restricted.

Supabase's current documentation states that without custom SMTP, the default provider only sends to addresses belonging to the project's organization/team, and it has a low rate limit. It is intended for testing/non-production use.

Official reference:

https://supabase.com/docs/guides/auth/auth-smtp

For a real Ledgerly release, configure a custom SMTP provider such as:
- Resend
- AWS SES
- Postmark
- SendGrid
- Brevo
- ZeptoMail

The sending domain should also have SPF/DKIM/DMARC configured for reliable delivery.

## 5. Recommended Ledgerly strategy

### Phase 1 — Keep the current secure architecture

Do not expose the Supabase secret key to the browser.

Keep:

Browser
→ authenticated Edge Function
→ Supabase Auth Admin API

This is the correct security boundary.

### Phase 2 — Configure production email delivery

Set up custom SMTP in Supabase Auth.

Recommended simple option for Ledgerly:
**Resend + a Ledgerly authentication subdomain/from-address.**

Example concept:

`no-reply@auth.ledgerly.app`

The actual domain can be chosen later.

### Phase 3 — New account invitation

For a family member who has no Auth account:

`family-invitation`
→ `auth.admin.inviteUserByEmail()`
→ Supabase Invite User template
→ email recipient
→ Ledgerly redirect
→ accept invitation
→ link `family_members.user_id`

This is already close to what Ledgerly does.

### Phase 4 — Existing account invitation

For an existing Ledgerly account:

Do **not** call `inviteUserByEmail()` expecting another invitation account.

Recommended flow:

`family-invitation`
→ verify existing account
→ generate/send a sign-in link
→ link contains the pending Ledgerly member context
→ user signs in
→ Ledgerly verifies the signed-in email against the pending member
→ Ledgerly links `family_members.user_id`
→ user enters the family

The current implementation already follows this general approach.

### Phase 5 — Optional polished family-invitation email

If we want the existing-account email to look exactly like a normal Ledgerly family invitation instead of a generic magic-link email, use a custom email-sending flow.

Supabase now supports a **Send Email Auth Hook**, which allows a custom email provider and custom authentication email logic.

Official documentation:

https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

This is the more advanced solution and should be implemented only after the basic custom SMTP flow is working.

## 6. Important distinction about `generateLink()`

Supabase also provides:

`supabase.auth.admin.generateLink()`

and supports an `invite` link type.

However, this does not mean that an existing confirmed Auth user can simply be re-invited as a new Auth identity. The application still needs to distinguish between a new account and an existing account.

For Ledgerly, the safest design is therefore:

- New account → Auth invite.
- Existing account → existing-account authentication link + family membership linking.

## 7. What should NOT be done

Do not:

- put the Supabase secret/service key in `NEXT_PUBLIC_*` variables,
- call `auth.admin.inviteUserByEmail()` directly from browser code,
- create duplicate Auth accounts for existing family members,
- automatically link a family member merely because an email was entered,
- trust a client-provided family ID without server-side authorization,
- delete or overwrite an existing Auth identity when inviting someone.

## 8. Test plan for the next Ledgerly test cycle

### Test A — New email

1. Create family.
2. Add member with an email that does not have a Ledgerly Auth account.
3. Click **Send invite**.
4. Verify Invite User email is delivered.
5. Open invitation.
6. Complete account setup.
7. Verify `family_members.user_id` is populated.
8. Verify the user sees the intended family.

### Test B — Existing email

1. Create a second family/member record using an already registered Ledgerly account email.
2. Click **Send invite**.
3. Verify the existing-account path is used.
4. Verify a sign-in link is delivered.
5. Sign in.
6. Verify the pending family member becomes linked to the signed-in Auth user.
7. Verify the correct family opens.

### Test C — Wrong account

1. Send invitation to an existing email.
2. Sign in as a different email.
3. Verify Ledgerly rejects the invitation.
4. Verify the pending member remains unlinked.

### Test D — Duplicate family email

1. Add the same email twice in the same family.
2. Verify the second invitation is rejected with the duplicate-family-member error.

### Test E — Delivery restrictions

Before production release, test an address that is not a Supabase organization member.

If default SMTP is still configured, expect delivery restrictions.

After custom SMTP is configured, repeat the test.

## 9. Current recommendation

**Do not replace the current invitation architecture yet.**

First configure custom SMTP and test both branches.

If the desired UX is specifically:

> “Every existing Ledgerly user should receive a beautiful Ledgerly Family Invitation email, not a generic sign-in email”

then the next implementation should be a dedicated custom invitation email flow using a server-side email provider (for example Resend), while retaining Supabase Auth for identity and the existing protected Edge Function for authorization.

## 10. Final finding

The correct answer is:

> **Yes, Supabase can send invitation emails.**

The limitation is not that Supabase cannot send invites. The limitation is that `inviteUserByEmail()` is intended for inviting an email that is not already an existing confirmed Auth user.

Ledgerly therefore needs **invite-new-user + authenticate-existing-user** as two branches of the same family invitation workflow.

The current code already implements most of this architecture. The next practical dependency for real external email delivery is **custom SMTP/email-provider configuration**.

---

## Excel export note

The attached Excel screenshot was also reviewed.

Excel is reporting:

- `/xl/styles.xml` XML error
- Styles load error at line 5, column 19
- repaired cell information in sheets 1–4

The workbook is still usable after Excel repair, but the screenshot confirms that Excel is repairing the generated OOXML rather than accepting it as fully clean.

Per the current instruction, this report does **not** modify the Excel exporter or the other Ledgerly work already completed. The Excel issue should be treated as a separate verification/fix track.

