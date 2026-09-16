from pathlib import Path
import re

page=Path('app/page.tsx')
s=page.read_text(encoding='utf-8')

# Shared client/formatter: keep the existing expanded UI, only replace duplicated infrastructure.
s=s.replace("import { createClient } from '@supabase/supabase-js';", "import { supabase } from '../lib/supabaseClient';\nimport { money } from '../lib/money';")
s=re.sub(r"\nconst supabase = createClient\([^\n]+\);", "", s, count=1)
s=re.sub(r"\nconst money=\(n:number\)=>new Intl\.NumberFormat\([^\n]+\);", "", s, count=1)

# Theme state + persistence.
needle="const [families,setFamilies]=useState<any[]>([]),[family,setFamily]=useState<any>(null),[members,setMembers]=useState<any[]>([]),[categories,setCategories]=useState<any[]>([]),[expenses,setExpenses]=useState<any[]>([]),[incomes,setIncomes]=useState<any[]>([]),[settlements,setSettlements]=useState<any[]>([]),[recurring,setRecurring]=useState<any[]>([]),[emis,setEmis]=useState<any[]>([]),[budgets,setBudgets]=useState<any[]>([]),[transfers,setTransfers]=useState<any[]>([]),[loans,setLoans]=useState<any[]>([]),[menu,setMenu]=useState(false);"
replacement=needle+"\n const [theme,setTheme]=useState<'light'|'dark'>('light');\n const [memberEdit,setMemberEdit]=useState<{id:string,name:string,email:string}|null>(null);\n const [settleForm,setSettleForm]=useState<{from:string,to:string,obligation:number,paid:string}|null>(null);"
if needle not in s: raise SystemExit('state needle not found')
s=s.replace(needle,replacement,1)

needle="useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);"
replacement=needle+"\n useEffect(()=>{const saved=typeof window!=='undefined'?localStorage.getItem('ledgerly_theme'):null;const next=(saved==='dark'||saved==='light')?saved:(typeof window!=='undefined'&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setTheme(next as 'light'|'dark');document.documentElement.dataset.theme=next},[]);\n function toggleTheme(){const next=theme==='dark'?'light':'dark';setTheme(next);localStorage.setItem('ledgerly_theme',next);document.documentElement.dataset.theme=next;}"
if needle not in s: raise SystemExit('auth effect needle not found')
s=s.replace(needle,replacement,1)

# Receipt viewing.
needle=" async function deleteExpense(id:string){if(!family)return;"
replacement=" async function viewReceipt(path:string){const {data,error}=await supabase.storage.from('ledgerly-receipts').createSignedUrl(path,60);if(error||!data?.signedUrl){setMsg(error?.message||'Could not open receipt.');return}window.open(data.signedUrl,'_blank','noopener,noreferrer')}\n async function deleteExpense(id:string){if(!family)return;"
if needle not in s: raise SystemExit('receipt insertion needle not found')
s=s.replace(needle,replacement,1)

# Replace native member prompts with state-backed form.
old=" async function editMember(id:string,name:string,email:string){const nextName=window.prompt('Member name',name);if(nextName===null||!nextName.trim())return;const nextEmail=window.prompt('Member email (optional)',email||'');const r=await supabase.from('family_members').update({name:nextName.trim(),email:nextEmail?.trim()||null}).eq('id',id);setMsg(r.error?.message||'Member updated.');if(!r.error)loadFamily(family.id)}"
new=" async function editMember(id:string,name:string,email:string){setMemberEdit({id,name,email})}\n async function saveMemberEdit(e:any){e.preventDefault();if(!family||!memberEdit||!memberEdit.name.trim())return;const r=await supabase.from('family_members').update({name:memberEdit.name.trim(),email:memberEdit.email.trim()||null}).eq('id',memberEdit.id);setMsg(r.error?.message||'Member updated.');if(!r.error){setMemberEdit(null);loadFamily(family.id)}}"
if old not in s: raise SystemExit('member prompt function not found')
s=s.replace(old,new,1)

# Settlement native prompt -> modal state.
old="<button className=\"btn\" onClick={()=>{const v=window.prompt(`Payment amount (max ${s.amount.toFixed(2)})`,s.amount.toFixed(2));const n=Number(v);if(n>0&&n<=s.amount)settle(s.fromId,s.toId,n,s.amount);}}>Record payment</button>"
new="<button className=\"btn\" onClick={()=>setSettleForm({from:s.fromId,to:s.toId,obligation:s.amount,paid:s.amount.toFixed(2)})}>Record payment</button>"
if old not in s: raise SystemExit('settlement prompt button not found')
s=s.replace(old,new,1)

# Receipt button in ledger rows.
old="<strong>{money(Number(e.amount))}</strong><div className=\"rowActions\">"
new="<strong>{money(Number(e.amount))}</strong>{e.receipt_path&&!e.deleted_at&&<button className=\"btn\" onClick={()=>viewReceipt(e.receipt_path)}>View receipt</button>}<div className=\"rowActions\">"
if old not in s: raise SystemExit('expense row receipt insertion not found')
s=s.replace(old,new,1)

# Theme control in menu.
old="<button onClick={()=>setScreen('settlements')}>Settlements</button><button onClick={()=>supabase.auth.signOut()}>Sign out</button>"
new="<button onClick={()=>setScreen('settlements')}>Settlements</button><button onClick={toggleTheme}>Theme: {theme==='dark'?'Light':'Dark'}</button><button onClick={()=>supabase.auth.signOut()}>Sign out</button>"
if old not in s: raise SystemExit('menu needle not found')
s=s.replace(old,new,1)

# Modal UI immediately inside content after toast.
needle="{msg&&<div className=\"notice toast\">{msg}<button onClick={()=>setMsg('')}>×</button></div>}"
modal=needle+"{memberEdit&&<div className=\"modalBackdrop\"><form className=\"modalCard\" onSubmit={saveMemberEdit}><div className=\"pageTitle\"><div><span className=\"eyebrow\">Family member</span><h2>Edit member</h2></div><button type=\"button\" className=\"linkBtn\" onClick={()=>setMemberEdit(null)}>Close</button></div><label>Name<input required value={memberEdit.name} onChange={e=>setMemberEdit({...memberEdit,name:e.target.value})}/></label><label>Email<input type=\"email\" value={memberEdit.email} onChange={e=>setMemberEdit({...memberEdit,email:e.target.value})}/></label><button className=\"btn primary full\">Save member</button></form></div>}{settleForm&&<div className=\"modalBackdrop\"><form className=\"modalCard\" onSubmit={e=>{e.preventDefault();const n=Number(settleForm.paid);if(n<=0||n>settleForm.obligation){setMsg(`Payment must be between ₹0.01 and ${money(settleForm.obligation)}.`);return}settle(settleForm.from,settleForm.to,n,settleForm.obligation);setSettleForm(null)}}><div className=\"pageTitle\"><div><span className=\"eyebrow\">Settlement</span><h2>Record payment</h2></div><button type=\"button\" className=\"linkBtn\" onClick={()=>setSettleForm(null)}>Close</button></div><p className=\"muted\">Maximum: {money(settleForm.obligation)}</p><label>Payment amount<input required type=\"number\" min=\"0.01\" max={settleForm.obligation} step=\"0.01\" value={settleForm.paid} onChange={e=>setSettleForm({...settleForm,paid:e.target.value})}/></label><button className=\"btn primary full\">Record payment</button></form></div>}"
if needle not in s: raise SystemExit('modal insertion needle not found')
s=s.replace(needle,modal,1)
page.write_text(s,encoding='utf-8')

# Shared modules and environment template.
Path('lib').mkdir(exist_ok=True)
Path('lib/supabaseClient.ts').write_text("import { createClient } from '@supabase/supabase-js';\n\nconst url=process.env.NEXT_PUBLIC_SUPABASE_URL;\nconst key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;\nif(!url||!key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');\nexport const supabase=createClient(url,key);\n",encoding='utf-8')
Path('lib/money.ts').write_text("export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);\n",encoding='utf-8')
Path('.env.example').write_text("NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\n",encoding='utf-8')

# /advanced is legacy duplicate UI; redirect to the canonical app.
Path('app/advanced/page.tsx').write_text("import { redirect } from 'next/navigation';\n\nexport default function Advanced(){\n  redirect('/');\n}\n",encoding='utf-8')

# Tokenize current CSS color usage and implement semantic Light/Dark variables.
cssp=Path('app/globals.css')
css=cssp.read_text(encoding='utf-8')
css=css.replace('html[data-theme=dark]{filter:invert(.92) hue-rotate(180deg)}','')
colors={
'#f5f2e8':'--bg','#17211b':'--text','#fffcf5':'--surface','#dfe7e1':'--border','#708077':'--muted','#1f6340':'--accent','#cde0d5':'--accent-border','#eef8f2':'--accent-soft','#d9e1dc':'--control-border','#405047':'--control-text','#dce5df':'--border-strong','#19322622':'--shadow','#f0f6f2':'--hover','#66756c':'--text-muted','#4e7561':'--eyebrow','#d9f4e4':'--accent-soft-strong','#738078':'--muted','#dfe8e1':'--border','#244a3610':'--shadow-soft','#edf1ee':'--divider','#e6f2eb':'--avatar-bg','#236247':'--accent-dark','#e0f5e7':'--success-soft','#177044':'--good','#bd3d2f':'--bad','#3d8b68':'--accent-mid','#e8f5ed':'--active-bg','#164b35':'--active-text','#154c36':'--selected-text','#d5dfd8':'--input-border','#fbfdfb':'--input-bg','#3c8b68':'--focus','#3c8b6817':'--focus-ring','#7b8880':'--muted-2','#f5f8f5':'--split-bg','#c8d7cd':'--split-border','#64736a':'--split-text','#dbe4de':'--split-control-border','#fffdf8':'--notice-bg','#f0dfa0':'--notice-border','#6e5b16':'--notice-text','#e8f7ed':'--success-bg','#c7e6d1':'--success-border','#f3f7f4':'--analysis-bg','#cbe6d7':'--code-muted','#eef3ef':'--seg-bg','#00000010':'--seg-shadow','#748078':'--nav-muted','#f6f8f5':'--auth-mid','#e9eef5':'--auth-end','#dff3e8':'--auth-start','#819087':'--empty'}
for hx,var in colors.items(): css=css.replace(hx,f'var({var})')
root='''\n:root{--bg:#f5f2e8;--text:#17211b;--surface:#fffcf5;--border:#dfe7e1;--muted:#708077;--accent:#1f6340;--accent-border:#cde0d5;--accent-soft:#eef8f2;--control-border:#d9e1dc;--control-text:#405047;--border-strong:#dce5df;--shadow:#19322622;--hover:#f0f6f2;--text-muted:#66756c;--eyebrow:#4e7561;--accent-soft-strong:#d9f4e4;--shadow-soft:#244a3610;--divider:#edf1ee;--avatar-bg:#e6f2eb;--accent-dark:#236247;--success-soft:#e0f5e7;--good:#177044;--bad:#bd3d2f;--accent-mid:#3d8b68;--active-bg:#e8f5ed;--active-text:#164b35;--selected-text:#154c36;--input-border:#d5dfd8;--input-bg:#fbfdfb;--focus:#3c8b68;--focus-ring:#3c8b6817;--muted-2:#7b8880;--split-bg:#f5f8f5;--split-border:#c8d7cd;--split-text:#64736a;--split-control-border:#dbe4de;--notice-bg:#fffdf8;--notice-border:#f0dfa0;--notice-text:#6e5b16;--success-bg:#e8f7ed;--success-border:#c7e6d1;--analysis-bg:#f3f7f4;--code-muted:#cbe6d7;--seg-bg:#eef3ef;--seg-shadow:#00000010;--nav-muted:#748078;--auth-mid:#f6f8f5;--auth-end:#e9eef5;--auth-start:#dff3e8;--empty:#819087;--on-accent:#fffcf5;}\n[data-theme=dark]{--bg:#0f1713;--text:#edf5ef;--surface:#18231d;--border:#2b3a31;--muted:#9aaca0;--accent:#59b989;--accent-border:#38664f;--accent-soft:#1d3528;--control-border:#35463b;--control-text:#c8d6cd;--border-strong:#34453b;--shadow:#00000066;--hover:#223229;--text-muted:#a6b5ad;--eyebrow:#7fbea0;--accent-soft-strong:#234b37;--divider:#2b3931;--avatar-bg:#21372b;--accent-dark:#86d2ad;--success-soft:#1d3d2b;--good:#73d29d;--bad:#ff8c7f;--accent-mid:#5fbe92;--active-bg:#214433;--active-text:#9be0bb;--selected-text:#a7e4c3;--input-border:#3b4c42;--input-bg:#121b16;--focus:#63c798;--focus-ring:#63c79833;--muted-2:#9baba3;--split-bg:#141f19;--split-border:#3b5145;--split-text:#a9b9b0;--split-control-border:#394a40;--notice-bg:#2a2617;--notice-border:#756b36;--notice-text:#eadf9b;--success-bg:#173526;--success-border:#2d5c42;--analysis-bg:#1b2a22;--code-muted:#a8dbc0;--seg-bg:#1b2921;--seg-shadow:#00000055;--nav-muted:#9aa9a1;--auth-mid:#151f1a;--auth-end:#101915;--auth-start:#1a3a2b;--empty:#9aaba2;--on-accent:#f4fff8;}\n.btn.primary,.miniLogo,.logoMark,.logo,.loading,.codeCard{color:var(--on-accent)}\n.modalBackdrop{position:fixed;inset:0;background:#00000066;display:grid;place-items:center;padding:18px;z-index:60}.modalCard{width:min(460px,100%);background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:20px;padding:20px;box-shadow:0 24px 70px #00000055;display:grid;gap:12px}.modalCard label{display:grid;gap:7px;font-size:13px;font-weight:800}.modalCard input{border:1px solid var(--input-border);border-radius:12px;padding:12px;background:var(--input-bg);color:var(--text);outline:none;width:100%}.full{width:100%}\n'''
css=root+css
css=css.replace('.hero{display:flex;justify-content:space-between;gap:20px;align-items:end;', '.hero{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;')
cssp.write_text(css,encoding='utf-8')
print('Phase 2/3 source patch applied')
