'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gkkrsadkjehmeobradxs.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_AHlcX2dM-2NTJ9LKOyYplg_CH4qSDmj'
);

const screenMap: Record<string, string> = {
  Home: 'home', Ledger: 'expenses', Add: 'add', 'Add expense': 'add',
  Analysis: 'insights', Family: 'family', Income: 'income',
  'Fixed & EMI': 'plans', Settlements: 'settlements', 'Family & code': 'family'
};

function labelOf(el: Element | null) { return (el?.textContent || '').replace(/\s+/g, ' ').trim(); }

export default function LedgerlyUxFixes() {
  const [recovery, setRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let disposed = false;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !disposed) {
        setRecovery(true);
        setMessage('Choose a new password for your Ledgerly account.');
      }
    });
    const injectForgotLink = () => {
      const card = document.querySelector('.authCard');
      const form = card?.querySelector('form');
      if (!card || !form || card.querySelector('[data-ledgerly-forgot]')) return;
      const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement | null;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.ledgerlyForgot = 'true'; button.textContent = 'Forgot password?';
      Object.assign(button.style, { border:'0', background:'transparent', color:'var(--ledgerly-accent,#2454a6)', fontWeight:'800', padding:'8px', cursor:'pointer', width:'100%', marginTop:'2px' });
      button.onclick = async () => {
        const email = emailInput?.value.trim() || '';
        if (!email) { alert('Enter your email address first.'); emailInput?.focus(); return; }
        button.disabled = true; button.textContent = 'Sending…';
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/?recovery=1` });
        button.disabled = false; button.textContent = 'Forgot password?';
        alert(error ? error.message : 'Reset link sent. Open the email and set your new password.');
      };
      form.appendChild(button);
    };
    const observer = new MutationObserver(injectForgotLink);
    observer.observe(document.body, { childList:true, subtree:true });
    injectForgotLink();
    if (new URLSearchParams(window.location.search).get('recovery') === '1') setRecovery(true);
    return () => { disposed = true; observer.disconnect(); data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const originalPush = history.pushState.bind(history);
    let suppress = false;
    const rememberClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest('button');
      if (!button) return;
      const text = labelOf(button);
      const match = Object.entries(screenMap).find(([key]) => text === key || text.startsWith(`${key} `));
      if (!match) return;
      if (suppress) { suppress = false; return; }
      const screen = match[1];
      if (history.state?.ledgerlyScreen !== screen) originalPush({ ledgerlyScreen: screen }, '', `#${screen}`);
    };
    const onPop = (event: PopStateEvent) => {
      const screen = event.state?.ledgerlyScreen || 'home';
      const targetText = Object.entries(screenMap).find(([, value]) => value === screen)?.[0];
      const target = Array.from(document.querySelectorAll('button')).find((b) => labelOf(b) === targetText);
      if (target) { suppress = true; (target as HTMLButtonElement).click(); }
    };
    history.replaceState({ ...(history.state || {}), ledgerlyScreen:'home' }, '', window.location.href.split('#')[0]);
    document.addEventListener('click', rememberClick, true);
    window.addEventListener('popstate', onPop);
    return () => { document.removeEventListener('click', rememberClick, true); window.removeEventListener('popstate', onPop); };
  }, []);

  useEffect(() => {
    const button = document.querySelector('[data-ledgerly-back]') as HTMLButtonElement | null;
    if (!button) return;
    const active = document.querySelector('.bottomNav .active');
    button.style.display = labelOf(active) && labelOf(active) !== 'Home' ? 'flex' : 'none';
  });

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setMessage('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setMessage('Passwords do not match.'); return; }
    setSaving(true); setMessage('');
    const { error } = await supabase.auth.updateUser({ password:newPassword });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Password updated successfully.'); setNewPassword(''); setConfirmPassword('');
  }

  return <>
    <button data-ledgerly-back type="button" aria-label="Go back" onClick={() => history.back()} style={{ display:'none', position:'fixed', top:82, left:14, zIndex:55, alignItems:'center', gap:6, border:'1px solid var(--ledgerly-border,#d7dce3)', background:'var(--ledgerly-surface,#fff)', color:'var(--ledgerly-text,#111827)', borderRadius:12, padding:'9px 12px', fontWeight:800, boxShadow:'0 6px 20px rgba(0,0,0,.08)' }}>← Back</button>
    {recovery && <div style={{ position:'fixed', inset:0, zIndex:100, display:'grid', placeItems:'center', padding:20, background:'var(--ledgerly-bg,#f4f6f9)' }}>
      <div style={{ width:'min(440px,100%)', background:'var(--ledgerly-surface,#fff)', border:'1px solid var(--ledgerly-border,#e2e6ec)', borderRadius:22, padding:24, boxShadow:'0 20px 60px rgba(0,0,0,.14)' }}>
        <button type="button" onClick={() => setRecovery(false)} style={{ border:0, background:'transparent', padding:0, color:'var(--ledgerly-accent,#2454a6)', fontWeight:800 }}>← Back to Ledgerly</button>
        <div style={{ marginTop:22, fontSize:12, fontWeight:900, letterSpacing:1.2, textTransform:'uppercase', color:'var(--ledgerly-accent,#2454a6)' }}>Account recovery</div>
        <h1 style={{ margin:'7px 0 8px', fontSize:30 }}>Set a new password</h1>
        <p style={{ color:'var(--ledgerly-muted,#6b7280)', lineHeight:1.5 }}>Your reset link is valid. Choose a new password below; you will not be sent straight to the dashboard.</p>
        <form onSubmit={updatePassword} style={{ display:'grid', gap:12, marginTop:18 }}>
          <label style={{ display:'grid', gap:7, fontWeight:800, fontSize:13 }}>New password<input autoFocus type="password" minLength={6} required value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding:12, borderRadius:12, border:'1px solid var(--ledgerly-border,#d6dce4)', background:'var(--ledgerly-input,#fbfcfe)', color:'inherit' }} /></label>
          <label style={{ display:'grid', gap:7, fontWeight:800, fontSize:13 }}>Confirm password<input type="password" minLength={6} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ padding:12, borderRadius:12, border:'1px solid var(--ledgerly-border,#d6dce4)', background:'var(--ledgerly-input,#fbfcfe)', color:'inherit' }} /></label>
          <button type="submit" disabled={saving} style={{ border:0, borderRadius:12, padding:13, background:'var(--ledgerly-accent,#2454a6)', color:'#fff', fontWeight:900 }}>{saving ? 'Updating…' : 'Update password'}</button>
        </form>
        {message && <div style={{ marginTop:14, padding:11, borderRadius:12, background:'var(--ledgerly-info-bg,#e8f1fb)', color:'var(--ledgerly-info,#215a9c)', fontSize:13 }}>{message}</div>}
        {message === 'Password updated successfully.' && <button type="button" onClick={() => setRecovery(false)} style={{ marginTop:12, border:'1px solid var(--ledgerly-border,#d6dce4)', borderRadius:12, padding:11, background:'transparent', fontWeight:800, width:'100%' }}>Continue to Ledgerly</button>}
      </div>
    </div>}
  </>;
}
