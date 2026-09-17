'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { money } from '../../lib/money';

const today=()=>new Date().toISOString().slice(0,10);
type SplitMode='single'|'equal'|'custom'|'percentage';
type Funding='member'|'household';

export default function TransactionsPage(){
 const [session,setSession]=useState<any>(null),[family,setFamily]=useState<any>(null),[members,setMembers]=useState<any[]>([]),[categories,setCategories]=useState<any[]>([]),[type,setType]=useState<'expense'|'income'>('expense'),[loading,setLoading]=useState(true),[msg,setMsg]=useState('');
 const [expense,setExpense]=useState({description:'',amount:'',date:today(),payer:'',fundingSource:'member' as Funding,category:'',split:'single' as SplitMode,members:[] as string[],custom:{} as Record<string,string>,percent:{} as Record<string,string>});
 const [income,setIncome]=useState({description:'Salary',amount:'',date:today(),source:'household',category:''});
 useEffect(()=>{const p=new URLSearchParams(window.location.search);setType(p.get('type')==='income'?'income':'expense');supabase.auth.getSession().then(async({data})=>{setSession(data.session);if(data.session)await load();else setLoading(false)})},[]);
 async function load(){
  setLoading(true);const {data:fs,error}=await supabase.from('families').select('*').order('created_at',{ascending:true});
  if(error){setMsg(error.message);setLoading(false);return}const saved=localStorage.getItem('ledgerly_family_id');const f=(fs||[]).find((x:any)=>x.id===saved)||(fs||[])[0];
  if(!f){setMsg('No family selected. Go back to Ledgerly and choose a family.');setLoading(false);return}setFamily(f);
  const [m,c]=await Promise.all([supabase.from('family_members').select('*').eq('family_id',f.id).eq('is_active',true).order('created_at'),supabase.from('categories').select('*').eq('family_id',f.id).order('kind').order('name')]);
  setMembers(m.data||[]);setCategories(c.data||[]);const first=(m.data||[])[0];
  setExpense(x=>({...x,payer:x.payer||first?.id||'',members:x.members.length?x.members:(first?.id?[first.id]:[]),category:x.category||(c.data||[]).find((z:any)=>z.kind==='expense')?.id||''}));
  setIncome(x=>({...x,category:x.category||(c.data||[]).find((z:any)=>z.kind==='income')?.id||''}));setLoading(false);
 }
 const selectedMembers=useMemo(()=>members.filter(m=>expense.members.includes(m.id)),[members,expense.members]);
 function allocations(amount:number){
  let ids=Array.from(new Set(expense.members.length?expense.members:[expense.payer]));if(expense.split==='single')ids=ids.slice(0,1);if(!ids.length)throw new Error('Select at least one responsible member.');
  if(expense.split==='equal'){const cents=Math.round(amount*100),base=Math.floor(cents/ids.length),rem=cents-base*ids.length;return ids.map((id,i)=>({member_id:id,amount:(base+(i===ids.length-1?rem:0))/100}));}
  if(expense.split==='custom')return ids.map(id=>({member_id:id,amount:Math.round(Number(expense.custom[id]||0)*100)/100}));
  if(expense.split==='percentage'){const p=ids.map(id=>Number(expense.percent[id]||0));if(Math.abs(p.reduce((a,b)=>a+b,0)-100)>0.001)throw new Error('Percentages must total 100%.');const cents=Math.round(amount*100);let used=0;return ids.map((id,i)=>{const c=i===ids.length-1?cents-used:Math.floor(cents*p[i]/100);used+=c;return{member_id:id,amount:c/100,percentage:p[i]}});}
  return [{member_id:ids[0],amount:Number(amount.toFixed(2))}];
 }
 async function saveExpense(e:any){
  e.preventDefault();if(!family||!session||!expense.description||!expense.amount||!expense.payer){setMsg('Complete description, amount and recorded payer.');return}const amount=Number(expense.amount);if(!Number.isFinite(amount)||amount<=0){setMsg('Amount must be greater than ₹0.');return}
  try{const alloc=allocations(amount);const sum=Math.round(alloc.reduce((s,a)=>s+Number(a.amount),0)*100)/100;if(Math.abs(sum-amount)>0.001)throw new Error(`Split must total ${money(amount)}.`);setLoading(true);
   const r=await supabase.from('expenses').insert({family_id:family.id,category_id:expense.category||null,description:expense.description.trim(),amount,expense_date:expense.date,expense_type:'variable',payment_method:null,notes:expense.fundingSource==='household'?'Household-funded expense':null,split_mode:expense.split,funding_source:expense.fundingSource,recorded_payer_id:expense.payer,created_by:session.user.id}).select().single();if(r.error)throw r.error;
   const ar=await supabase.from('expense_allocations').insert(alloc.map(a=>({...a,expense_id:r.data.id})));if(ar.error)throw ar.error;
   const pr=await supabase.from('expense_payers').insert({expense_id:r.data.id,member_id:expense.payer,amount});if(pr.error)throw pr.error;
   window.location.href='/';
  }catch(err:any){setMsg(err.message||'Could not save expense.');setLoading(false)}
 }
 async function saveIncome(e:any){
  e.preventDefault();if(!family||!session||!income.amount){setMsg('Enter an income amount.');return}const amount=Number(income.amount);if(!Number.isFinite(amount)||amount<=0){setMsg('Amount must be greater than ₹0.');return}setLoading(true);
  const r=await supabase.from('incomes').insert({family_id:family.id,member_id:income.source==='household'?null:income.source,category_id:income.category||null,description:income.description||'Income',amount,income_date:income.date,created_by:session.user.id});
  if(r.error){setMsg(r.error.message);setLoading(false);return}window.location.href='/';
 }
 if(!session&&!loading)return <main className="auth"><div className="authCard"><h1>Sign in required</h1><p>Please sign in to add a transaction.</p><button className="btn primary full" onClick={()=>window.location.href='/'}>Back to Ledgerly</button></div></main>;
 return <main className="auth" style={{alignItems:'start',paddingTop:28}}><div className="authCard wide" style={{maxWidth:760}}>
  <div className="pageTitle"><div><span className="eyebrow">Ledgerly</span><h1>Add {type==='income'?'income':'expense'}</h1><p>{family?.name||'Family'} · shared money tracking</p></div><button className="linkBtn" onClick={()=>window.location.href='/'}>Back</button></div>
  <div className="seg"><button type="button" className={type==='expense'?'on':''} onClick={()=>{setType('expense');window.history.replaceState({},'','/transactions?type=expense')}}>Expense</button><button type="button" className={type==='income'?'on':''} onClick={()=>{setType('income');window.history.replaceState({},'','/transactions?type=income')}}>Income</button></div>
  {msg&&<div className="notice">{msg}</div>}
  {type==='income'?<form className="expenseForm" onSubmit={saveIncome}>
   <label>Description<input value={income.description} onChange={e=>setIncome({...income,description:e.target.value})}/></label><label>Amount<input required type="number" min="0.01" step="0.01" value={income.amount} onChange={e=>setIncome({...income,amount:e.target.value})}/></label>
   <label>Income source<select value={income.source} onChange={e=>setIncome({...income,source:e.target.value})}><option value="household">Household / Home income</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <label>Category<select value={income.category} onChange={e=>setIncome({...income,category:e.target.value})}>{categories.filter(c=>c.kind==='income'&&c.is_active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Date<input type="date" value={income.date} onChange={e=>setIncome({...income,date:e.target.value})}/></label>
   <div className="formFooter span2"><button className="btn primary" disabled={loading}>{loading?'Saving…':'Add income'}</button></div>
  </form>:<form className="expenseForm" onSubmit={saveExpense}>
   <label className="span2">What was it for?<input required value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})} placeholder="Groceries, electricity, dinner…"/></label>
   <label>Amount<input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></label>
   <label>Paid from<select value={expense.fundingSource} onChange={e=>setExpense({...expense,fundingSource:e.target.value as Funding})}><option value="member">Member's money</option><option value="household">Household / Home money</option></select></label>
   <label>{expense.fundingSource==='household'?'Recorded payer':'Payer'}<select value={expense.payer} onChange={e=>setExpense({...expense,payer:e.target.value})}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Date<input type="date" value={expense.date} onChange={e=>setExpense({...expense,date:e.target.value})}/></label>
   <label className="span2">Responsibility<select value={expense.split} onChange={e=>setExpense({...expense,split:e.target.value as SplitMode})}><option value="single">Single member</option><option value="equal">Equal split</option><option value="custom">Custom amounts</option><option value="percentage">Percentage split</option></select></label>
   <div className="splitBox span2"><p>Select responsible members.</p><div className="memberChecks">{members.map(m=><label key={m.id}><input type="checkbox" checked={expense.members.includes(m.id)} onChange={e=>setExpense(x=>({...x,members:e.target.checked?Array.from(new Set([...x.members,m.id])):x.members.filter(id=>id!==m.id)}))}/>{m.name}</label>)}</div>{(expense.split==='custom'||expense.split==='percentage')&&selectedMembers.map(m=><div className="splitInput" key={m.id}><span>{m.name}</span><input type="number" min="0" step="0.01" value={expense.split==='custom'?(expense.custom[m.id]||''):(expense.percent[m.id]||'')} onChange={e=>expense.split==='custom'?setExpense(x=>({...x,custom:{...x.custom,[m.id]:e.target.value}})):setExpense(x=>({...x,percent:{...x.percent,[m.id]:e.target.value}}))}/><small>{expense.split==='custom'?'₹':'%'}</small></div>)}</div>
   <div className="formFooter span2"><span className="muted">Household-funded expenses do not create a personal receivable for the recorded payer.</span><button className="btn primary" disabled={loading}>{loading?'Saving…':'Save expense'}</button></div>
  </form>}
 </div></main>;
}
