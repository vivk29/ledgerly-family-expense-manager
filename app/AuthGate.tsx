'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const url = new URL(window.location.href);
    const hasRecoveryHash = url.hash.includes('type=recovery') || url.hash.includes('access_token=');
    const hasRecoveryFlag = url.searchParams.get('recovery') === '1';
    const recoveryCode = url.searchParams.get('code');

    const finishReady = (nextSession: any) => {
      if (!active) return;
      setSession(nextSession);
      if (hasRecoveryFlag || hasRecoveryHash || !!recoveryCode) setMode('reset');
      setReady(true);
    };

    const start = async () => {
      if (recoveryCode) {
        const { data } = await supabase.auth.exchangeCodeForSession(recoveryCode);
        finishReady(data?.session || null);
      } else {
        const { data } = await supabase.auth.getSession();
        finishReady(data.session);
      }
    };
    start();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setMode('reset');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false); if (error) setMessage(error.message);
  }

  async function register(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    if (password.length < 6) { setBusy(false); setMessage('Password must be at least 6 characters.'); return; }
    if (password !== password2) { setBusy(false); setMessage('Passwords do not match.'); return; }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin }
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    if (data.session) setMessage('Account created. You are signed in.');
    else { setMode('login'); setMessage('Account created. Check your email to confirm your account, then log in.'); }
  }

  async function forgot(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    const redirectTo = `${window.location.origin}/?recovery=1`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false); setMessage(error?.message || 'Password reset email sent. Open it to set your new password.');
  }

  async function reset(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    if (password.length < 6 || password !== password2) { setBusy(false); setMessage('Enter matching passwords of at least 6 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    await supabase.auth.signOut();
    setPassword(''); setPassword2(''); setMode('login'); setMessage('Password updated successfully. You can now log in with your new password.');
  }

  if (!ready) return <div style={overlay}><div style={card}><div style={logo}>₹</div><h2 style={{ margin: 0 }}>Ledgerly</h2><p style={muted}>Checking your secure session…</p></div></div>;
  if (session && mode !== 'reset') return <>{children}</>;

  const title = mode === 'register' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Set a new password' : 'Welcome back';
  return <div style={overlay}>
    <div style={card}>
      <div style={brand}><div style={logo}>₹</div><div><b style={{ fontSize: 19 }}>Ledgerly</b><small style={muted}>Family money, clearly.</small></div></div>
      <h1 style={{ fontSize: 30, margin: '26px 0 8px' }}>{title}</h1>
      <p style={muted}>{mode === 'register' ? 'Create your secure Ledgerly account with your name, email and password.' : mode === 'reset' ? 'The reset link is valid. Set your new password below, then continue to Ledgerly.' : 'Use your email and password to access your family ledger.'}</p>
      {mode !== 'reset' && <div style={tabs}>
        <button type="button" style={tab(mode === 'login')} onClick={() => { setMode('login'); setMessage(''); }}>Log in</button>
        <button type="button" style={tab(mode === 'register')} onClick={() => { setMode('register'); setMessage(''); }}>Register</button>
        <button type="button" style={tab(mode === 'forgot')} onClick={() => { setMode('forgot'); setMessage(''); }}>Forgot</button>
      </div>}
      {mode === 'login' && <form onSubmit={login} style={form}><label style={label}>Email<input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label style={label}>Password<input style={input} type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label><button style={primary} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button></form>}
      {mode === 'register' && <form onSubmit={register} style={form}><label style={label}>Full name<input style={input} required value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" /></label><label style={label}>Email<input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label style={label}>Password<input style={input} type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label><label style={label}>Confirm password<input style={input} type="password" required minLength={6} value={password2} onChange={e => setPassword2(e.target.value)} autoComplete="new-password" /></label><button style={primary} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button></form>}
      {mode === 'forgot' && <form onSubmit={forgot} style={form}><label style={label}>Email<input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><button style={primary} disabled={busy}>{busy ? 'Sending…' : 'Send reset email'}</button></form>}
      {mode === 'reset' && <form onSubmit={reset} style={form}><label style={label}>New password<input style={input} type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label><label style={label}>Confirm new password<input style={input} type="password" required minLength={6} value={password2} onChange={e => setPassword2(e.target.value)} autoComplete="new-password" /></label><button style={primary} disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form>}
      {message && <div style={notice}>{message}</div>}
    </div>
  </div>;
}

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 20, background: 'var(--bg)' };
const card: React.CSSProperties = { width: 'min(440px,100%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 22, padding: 24, boxShadow: '0 20px 60px var(--shadow)', color: 'var(--text)' };
const brand: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const logo: React.CSSProperties = { width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 13, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 900, fontSize: 20 };
const muted: React.CSSProperties = { color: 'var(--muted)', lineHeight: 1.5 };
const tabs: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4, background: 'var(--seg-bg)', borderRadius: 12, margin: '18px 0' };
const tab = (on: boolean): React.CSSProperties => ({ border: 0, borderRadius: 9, padding: 10, fontWeight: 800, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)' });
const form: React.CSSProperties = { display: 'grid', gap: 12, marginTop: 18 };
const label: React.CSSProperties = { display: 'grid', gap: 7, fontSize: 13, fontWeight: 800 };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--input-border)', borderRadius: 12, padding: 12, background: 'var(--input-bg)', color: 'var(--text)' };
const primary: React.CSSProperties = { border: 0, borderRadius: 12, padding: 12, background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 900 };
const notice: React.CSSProperties = { marginTop: 14, padding: 11, borderRadius: 12, background: 'var(--notice-bg)', border: '1px solid var(--notice-border)', color: 'var(--notice-text)', fontSize: 13 };
