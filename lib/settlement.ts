export type Balance = { id: string; name: string; is_active: boolean; net: number };

export type TransferSuggestion = {
  fromId: string; toId: string; fromName: string; toName: string; amount: number;
};

export function minimizeTransfers(balances: Balance[]): TransferSuggestion[] {
  const debtors = balances.filter(x => x.is_active && x.net < -0.01)
    .map(x => ({ id:x.id, name:x.name, amount:round(-x.net) }));
  const creditors = balances.filter(x => x.is_active && x.net > 0.01)
    .map(x => ({ id:x.id, name:x.name, amount:round(x.net) }));
  const out: TransferSuggestion[] = [];
  let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const amount=round(Math.min(debtors[i].amount, creditors[j].amount));
    if(amount>0.01) out.push({fromId:debtors[i].id,toId:creditors[j].id,fromName:debtors[i].name,toName:creditors[j].name,amount});
    debtors[i].amount=round(debtors[i].amount-amount);
    creditors[j].amount=round(creditors[j].amount-amount);
    if(debtors[i].amount<=0.01)i++;
    if(creditors[j].amount<=0.01)j++;
  }
  return out;
}
function round(n:number){return Math.round(n*100)/100;}
