'use client';
import { useEffect, useState } from 'react';

export default function LedgerlyInteractionPatch(){
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    if(window.location.pathname==='/transactions') return;
    const onClick=(e:MouseEvent)=>{
      const t=e.target as HTMLElement;
      const add=t.closest('.addFab') as HTMLElement|null;
      const navAdd=t.closest('.bottomNav button:nth-child(3)') as HTMLElement|null;
      if(add||navAdd){e.preventDefault();e.stopPropagation();setOpen(v=>!v);return;}
      if(open && !t.closest('.ledgerly-global-add')) setOpen(false);
    };
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};
    const onPop=()=>{if(open){setOpen(false);window.history.pushState({ledgerlyAdd:true},'',window.location.href)}};
    document.addEventListener('click',onClick,true);
    document.addEventListener('keydown',onKey);
    window.addEventListener('popstate',onPop);
    return()=>{document.removeEventListener('click',onClick,true);document.removeEventListener('keydown',onKey);window.removeEventListener('popstate',onPop)};
  },[open]);
  if(!open||typeof window==='undefined'||window.location.pathname==='/transactions') return null;
  const go=(kind:'expense'|'income')=>{window.location.href=`/transactions?type=${kind}`};
  return <div className="ledgerly-global-add" style={{position:'fixed',zIndex:100,left:'50%',bottom:78,transform:'translateX(-50%)',width:'min(360px,calc(100% - 24px))',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:18,boxShadow:'0 20px 60px var(--shadow)',padding:8}}>
    <button type="button" onClick={()=>go('expense')} style={{display:'block',width:'100%',textAlign:'left',border:0,background:'transparent',padding:'13px 14px',borderRadius:12,color:'var(--text)'}}><b>Expense</b><small style={{display:'block',marginTop:3,color:'var(--muted)'}}>Record money spent</small></button>
    <button type="button" onClick={()=>go('income')} style={{display:'block',width:'100%',textAlign:'left',border:0,background:'transparent',padding:'13px 14px',borderRadius:12,color:'var(--text)'}}><b>Income</b><small style={{display:'block',marginTop:3,color:'var(--muted)'}}>Record personal or household income</small></button>
  </div>;
}
