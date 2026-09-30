type ExcelJSNamespace = any;

declare global { interface Window { ExcelJS?: ExcelJSNamespace; } }

let excelJsPromise: Promise<ExcelJSNamespace> | null = null;

async function loadExcelJS(): Promise<ExcelJSNamespace> {
  if (typeof window === 'undefined') throw new Error('Excel export is only available in the browser.');
  if (window.ExcelJS) return window.ExcelJS;
  if (!excelJsPromise) {
    excelJsPromise = new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-ledgerly-exceljs]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load',()=>resolve(window.ExcelJS!));
        existing.addEventListener('error',()=>reject(new Error('Could not load Excel export library.')));
        return;
      }
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      script.async=true;
      script.dataset.ledgerlyExceljs='true';
      script.onload=()=>window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS loaded but was not available.'));
      script.onerror=()=>reject(new Error('Could not load Excel export library. Check your internet connection and try again.'));
      document.head.appendChild(script);
    });
  }
  return excelJsPromise;
}

export interface ExportBundle {
  family: any;
  members: any[];
  categories: any[];
  incomes: any[];
  expenses: any[];
  paymentAccounts: any[];
  transfers: any[];
  loans: any[];
  exportedBy: string;
  exportedAt: string;
}

const ACCOUNT_TYPE_LABEL: Record<string,string> = {
  credit_card: 'Credit Card',
  bank_account: 'Bank Account',
  debit_card: 'Debit Card',
  upi: 'UPI',
};

const PURPOSE_LABEL: Record<string,string> = {
  home_expense: 'Home expenses (track only)',
  personal: 'Personal / reimbursement',
  loan: 'Loan',
};

const INR_FORMAT = '₹#,##,##0.00';
const DATE_FORMAT = 'dd-mm-yyyy';

const memberName = (members:any[], id:string|null|undefined) =>
  members.find(m => m.id === id)?.name ?? 'N/A';

const categoryName = (categories:any[], id:string|null|undefined) =>
  categories.find(c => c.id === id)?.name ?? 'N/A';

const accountLabel = (accounts:any[], id:string|null|undefined) => {
  const a = accounts.find(x => x.id === id);
  return a ? `${a.name} (${ACCOUNT_TYPE_LABEL[a.account_type] ?? a.account_type})` : 'N/A';
};

function fmtDate(value:string|null|undefined) {
  if (!value) return 'N/A';
  const [y,m,d] = value.split('-');
  return y && m && d ? `${d}-${m}-${y}` : value;
}

function fmtTimestamp(value:string|null|undefined) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n:number) => String(n).padStart(2,'0');
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function num(value:any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function expenseRows(bundle:ExportBundle) {
  const rows:any[][] = [];
  for (const e of bundle.expenses) {
    const payers = e.expense_payers?.length ? e.expense_payers : [{member_id:null,amount:e.amount}];
    const allocations = e.expense_allocations?.length ? e.expense_allocations : [{member_id:null,amount:e.amount,percentage:null}];
    for (const allocation of allocations) {
      const payer = payers[0];
      rows.push([
        e.id, fmtDate(e.expense_date), e.description, num(e.amount),
        categoryName(bundle.categories,e.category_id), 'N/A',
        memberName(bundle.members,payer.member_id), payer.member_id ?? 'N/A',
        memberName(bundle.members,allocation.member_id), allocation.member_id ?? 'N/A',
        num(allocation.amount), e.payment_method ?? 'N/A',
        accountLabel(bundle.paymentAccounts,e.payment_account_id),
        e.payment_account_id ?? 'N/A', e.notes ?? '',
        fmtTimestamp(e.created_at), fmtTimestamp(e.updated_at)
      ]);
    }
  }
  return rows;
}

function autoWidths(ws:any) {
  ws.columns.forEach(col => {
    let max = 12;
    col.eachCell({includeEmpty:false}, cell => {
      const v = cell.value;
      const text = v == null ? '' : String(typeof v === 'object' && 'result' in v ? (v as any).result : v);
      max = Math.max(max, Math.min(42, text.length + 2));
    });
    col.width = Math.min(42, max);
  });
}

function styleSheet(ws:ExcelJS.Worksheet) {
  ws.views = [{state:'frozen', ySplit:1}];
  ws.autoFilter = undefined;
  ws.eachRow((row,rowNumber) => {
    row.eachCell(cell => {
      cell.alignment = {vertical:'top', wrapText:true};
      if (rowNumber === 1) {
        cell.font = {bold:true,color:{argb:'FFFFFFFF'}};
        cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF1F6340'}};
      }
    });
  });
  autoWidths(ws);
}

function addTable(ws:ExcelJS.Worksheet, name:string, headers:string[], rows:any[][]) {
  ws.addTable({
    name,
    ref:'A1',
    headerRow:true,
    style:{theme:'TableStyleMedium9',showRowStripes:true},
    columns:headers.map(h=>({name:h,filterButton:true})),
    rows
  });
  styleSheet(ws);
}

function setCurrencyColumn(ws:ExcelJS.Worksheet, index:number) {
  ws.getColumn(index).eachCell((cell,rowNumber) => {
    if (rowNumber > 1 && typeof cell.value === 'number') cell.numFmt = INR_FORMAT;
  });
}

function addNoRecordsNote(ws:ExcelJS.Worksheet, message = 'No records available') {
  ws.getCell('A2').value = message;
  ws.getCell('A2').font = {italic:true,color:{argb:'FF666666'}};
}

export async function fetchExportBundle(
  supabase:any,
  familyId:string,
  exportedBy:string
):Promise<ExportBundle> {
  const [family,members,categories,incomes,expenses,paymentAccounts,transfers,loans] = await Promise.all([
    supabase.from('families').select('id,name,family_code,created_by,created_at').eq('id',familyId).single(),
    supabase.from('family_members').select('id,family_id,user_id,name,email,income_monthly,budget_monthly,is_active,created_at').eq('family_id',familyId).order('created_at'),
    supabase.from('categories').select('id,family_id,name,kind,created_at,is_active').eq('family_id',familyId).order('kind').order('name'),
    supabase.from('incomes').select('id,family_id,member_id,category_id,description,amount,income_date,notes,created_by,created_at').eq('family_id',familyId).order('income_date'),
    supabase.from('expenses').select('id,family_id,category_id,description,amount,expense_date,expense_type,payment_method,payment_account_id,notes,created_by,created_at,updated_at,expense_payers(member_id,amount),expense_allocations(member_id,amount,percentage)').eq('family_id',familyId).is('deleted_at',null).order('expense_date'),
    supabase.from('payment_accounts').select('id,family_id,member_id,account_type,name,is_active,created_at').eq('family_id',familyId).order('created_at'),
    supabase.from('family_transfers').select('id,family_id,from_member_id,to_member_id,amount,date,notes,purpose,created_at').eq('family_id',familyId).order('date'),
    supabase.from('family_loans').select('id,family_id,name,principal,outstanding,from_member_id,to_member_id,due_date,status,notes,created_at').eq('family_id',familyId).order('created_at')
  ]);

  const errors = [family,members,categories,incomes,expenses,paymentAccounts,transfers,loans].filter(x=>x.error);
  if (errors.length) throw new Error(errors.map(x=>x.error.message).join('; '));

  return {
    family:family.data,
    members:members.data ?? [],
    categories:categories.data ?? [],
    incomes:incomes.data ?? [],
    expenses:expenses.data ?? [],
    paymentAccounts:paymentAccounts.data ?? [],
    transfers:transfers.data ?? [],
    loans:loans.data ?? [],
    exportedBy,
    exportedAt:new Date().toISOString()
  };
}

export function buildLedgerlyWorkbook(bundle:ExportBundle) {
  const wb = new (window.ExcelJS as any).Workbook();
  wb.creator = 'Ledgerly';
  wb.subject = 'Ledgerly family financial data export';
  wb.title = 'Ledgerly Data Export';
  wb.created = new Date(bundle.exportedAt);

  const incomeRows = bundle.incomes.map(i => [
    i.id, fmtDate(i.income_date), memberName(bundle.members,i.member_id), i.member_id ?? 'N/A',
    num(i.amount), categoryName(bundle.categories,i.category_id), i.description,
    i.notes ?? '', fmtTimestamp(i.created_at), 'N/A'
  ]);

  const expenses = expenseRows(bundle);

  const overview = wb.addWorksheet('Overview');
  overview.columns = [{width:30},{width:34}];
  overview.addRows([
    ['Ledgerly Data Export',''],
    ['Family Name',bundle.family?.name ?? 'N/A'],
    ['Export Date/Time',fmtTimestamp(bundle.exportedAt)],
    ['Exported By',bundle.exportedBy || 'N/A'],
    ['Total Family Members',bundle.members.length],
    ['Total Income',{formula:'=SUM(Incomes!E2:E1048576)'}],
    ['Total Expenses',{formula:'=SUM(Expenses!D2:D1048576)'}],
    ['Net Amount / Balance',{formula:'=B6-B7'}],
    ['Total Transactions',bundle.incomes.length + bundle.expenses.length],
    ['Income Transactions',bundle.incomes.length],
    ['Expense Transactions',bundle.expenses.length],
    ['Payment Accounts',bundle.paymentAccounts.length],
    ['Date Range Covered',(() => {
      const ds=[...bundle.incomes.map(x=>x.income_date),...bundle.expenses.map(x=>x.expense_date)].filter(Boolean).sort();
      return ds.length ? `${fmtDate(ds[0])} to ${fmtDate(ds[ds.length-1])}` : 'No transactions';
    })()]
  ]);
  overview.getRow(1).font={bold:true,size:16,color:{argb:'FFFFFFFF'}};
  overview.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F6340'}};
  overview.getColumn(2).eachCell((c,r)=>{if(r===6||r===7||r===8)c.numFmt=INR_FORMAT});
  overview.views=[{state:'frozen',ySplit:1}];

  const members = wb.addWorksheet('Family Members');
  addTable(members,'FamilyMembers',[
    'Member ID','Name','Email','Role','User ID','Status','Created At','Updated At'
  ],bundle.members.map(m=>[
    m.id,m.name,m.email ?? 'N/A','N/A',m.user_id ?? 'N/A',
    m.is_active ? 'Active':'Archived',fmtTimestamp(m.created_at),'N/A'
  ]));

  const income = wb.addWorksheet('Income');
  addTable(income,'Incomes',[
    'Income ID','Date','Member','Member ID','Amount','Category','Description','Notes','Created At','Updated At'
  ],incomeRows);
  setCurrencyColumn(income,5);
  if (!incomeRows.length) addNoRecordsNote(income);

  const expense = wb.addWorksheet('Expenses');
  addTable(expense,'Expenses',[
    'Expense ID','Date','Description','Amount','Category','Subcategory','Who Paid','Payer Member ID',
    'Who Will Pay / Responsible','Responsible Member ID','Allocated Amount','Payment Method','Payment Account',
    'Payment Account ID','Notes','Created At','Updated At'
  ],expenses);
  setCurrencyColumn(expense,4); setCurrencyColumn(expense,11);
  if (!expenses.length) addNoRecordsNote(expense);

  const accounts = wb.addWorksheet('Payment Accounts');
  addTable(accounts,'PaymentAccounts',[
    'Account ID','Family ID','Member ID','Member Name','Account Type','Account/Card Name','Active','Created At'
  ],bundle.paymentAccounts.map(a=>[
    a.id,a.family_id,a.member_id,memberName(bundle.members,a.member_id),
    ACCOUNT_TYPE_LABEL[a.account_type] ?? a.account_type,a.name,
    a.is_active?'Active':'Inactive',fmtTimestamp(a.created_at)
  ]));
  if (!bundle.paymentAccounts.length) addNoRecordsNote(accounts);

  const ledgerRows = [
    ...bundle.incomes.map(i=>[
      i.id,'Income',fmtDate(i.income_date),memberName(bundle.members,i.member_id),i.member_id ?? 'N/A',
      i.description,categoryName(bundle.categories,i.category_id),num(i.amount),'N/A','N/A','N/A','N/A',i.notes ?? ''
    ]),
    ...expenses.map(e=>[
      e[0],'Expense',e[1],e[6],e[7],e[2],e[4],e[3],e[11],e[12],e[8],e[9],e[14]
    ])
  ].sort((a,b)=>String(a[2]).localeCompare(String(b[2])));

  const ledger = wb.addWorksheet('Transactions');
  addTable(ledger,'TransactionsTable',[
    'Transaction ID','Transaction Type','Date','Member / Payer','Member ID','Description','Category',
    'Amount','Payment Method','Payment Account','Who Paid','Who Is Responsible','Notes'
  ],ledgerRows);
  setCurrencyColumn(ledger,8);
  if (!ledgerRows.length) addNoRecordsNote(ledger);

  const cat = wb.addWorksheet('Categories');
  const catRows:any[][]=[];
  for (const kind of ['income','expense']) {
    const source = kind==='income'
      ? bundle.incomes.map(i=>({date:i.income_date,categoryId:i.category_id,amount:num(i.amount)}))
      : bundle.expenses.flatMap(e => (e.expense_allocations?.length ? e.expense_allocations : [{member_id:null,amount:e.amount}]).map((a:any)=>({date:e.expense_date,categoryId:e.category_id,amount:num(a.amount)})));
    const groups = new Map<string,{total:number,count:number,min:string,max:string}>();
    for (const x of source) {
      const key=x.categoryId ?? 'N/A';
      const g=groups.get(key) ?? {total:0,count:0,min:x.date,max:x.date};
      g.total+=x.amount; g.count++; if(x.date<g.min)g.min=x.date;if(x.date>g.max)g.max=x.date;groups.set(key,g);
    }
    const grand=source.reduce((s,x)=>s+x.amount,0);
    for (const [id,g] of groups) catRows.push([kind==='income'?'Income':'Expense',categoryName(bundle.categories,id),g.count,g.total,grand?g.total/grand:0,`${fmtDate(g.min)} to ${fmtDate(g.max)}`]);
  }
  addTable(cat,'CategoryBreakdown',['Transaction Type','Category','Number of Transactions','Total Amount','Percentage of Total','Date Range'],catRows);
  setCurrencyColumn(cat,4);
  cat.getColumn(5).numFmt='0.00%';
  if (!catRows.length) addNoRecordsNote(cat);

  const memberSummary = wb.addWorksheet('Member Summary');
  const memberRows=bundle.members.map(m=>{
    const mi=bundle.incomes.filter(i=>i.member_id===m.id).reduce((s,i)=>s+num(i.amount),0);
    const paid=bundle.expenses.filter(e=>e.expense_payers?.some((p:any)=>p.member_id===m.id)).reduce((s,e)=>s+num(e.amount),0);
    const responsible=bundle.expenses.reduce((s,e)=>s+(e.expense_allocations||[]).filter((a:any)=>a.member_id===m.id).reduce((x:number,a:any)=>x+num(a.amount),0),0);
    const methods=['Bank Transfer','Credit Card','Debit Card','UPI','Cash','Other'].map(method=>bundle.expenses.filter(e=>e.payment_method===method&&e.expense_payers?.some((p:any)=>p.member_id===m.id)).reduce((s,e)=>s+num(e.amount),0));
    return [m.name,mi,paid,responsible,bundle.incomes.filter(i=>i.member_id===m.id).length,bundle.expenses.filter(e=>e.expense_payers?.some((p:any)=>p.member_id===m.id)).length,...methods];
  });
  addTable(memberSummary,'MemberSummary',['Member','Total Income','Total Expenses Paid','Total Expenses Responsible','Income Entries','Expense Entries','Bank Transfer','Credit Card','Debit Card','UPI','Cash','Other'],memberRows);
  [2,3,4,7,8,9,10,11,12].forEach(i=>setCurrencyColumn(memberSummary,i));

  const pm = wb.addWorksheet('Payment Methods');
  const methods=['Cash','Bank Transfer','Credit Card','Debit Card','UPI','Other'];
  const pmRows=methods.map(method=>{
    const rows=bundle.expenses.filter(e=>e.payment_method===method);
    const total=rows.reduce((s,e)=>s+num(e.amount),0);
    const grand=bundle.expenses.reduce((s,e)=>s+num(e.amount),0);
    return [method,rows.length,total,grand?total/grand:0,new Set(rows.map(e=>e.payment_account_id).filter(Boolean)).size];
  }).filter(r=>r[1]>0);
  addTable(pm,'PaymentMethodSummary',['Payment Method','Number of Transactions','Total Amount','Percentage of Expenses','Number of Different Accounts Used'],pmRows);
  setCurrencyColumn(pm,3); pm.getColumn(4).numFmt='0.00%';

  const transfers = wb.addWorksheet('Transfer Details');
  const transferRows=bundle.transfers.map(t=>[
    t.id,fmtDate(t.date),t.notes ?? 'N/A',num(t.amount),
    memberName(bundle.members,t.from_member_id),memberName(bundle.members,t.to_member_id),
    PURPOSE_LABEL[t.purpose] ?? t.purpose ?? 'N/A',t.from_member_id,t.to_member_id,
    t.purpose==='home_expense'?'No balance effect (tracking only)':'Affects balance',t.notes ?? ''
  ]);
  addTable(transfers,'TransferDetails',['Transfer ID','Date','Description / Notes','Amount','Who Paid / From','Who Is Responsible / To','Transfer Purpose','From Member ID','To Member ID','Balance Effect','Notes'],transferRows);
  setCurrencyColumn(transfers,4);
  if (!transferRows.length) addNoRecordsNote(transfers);

  const loans = wb.addWorksheet('Family Loans');
  const loanRows=bundle.loans.map(l=>[
    l.id,l.name,num(l.principal),l.outstanding==null?'N/A':num(l.outstanding),
    memberName(bundle.members,l.from_member_id),memberName(bundle.members,l.to_member_id),
    l.due_date?fmtDate(l.due_date):'N/A',l.status,l.notes ?? '',fmtTimestamp(l.created_at)
  ]);
  addTable(loans,'FamilyLoans',['Loan ID','Name','Principal','Outstanding','From Member','To Member','Due Date','Status','Notes','Created At'],loanRows);
  setCurrencyColumn(loans,3); setCurrencyColumn(loans,4);
  if (!loanRows.length) addNoRecordsNote(loans);

  const monthly=wb.addWorksheet('Monthly Summary');
  const monthMap=new Map<string,{income:number,expense:number,incomeCount:number,expenseCount:number,expenses:number[],incomes:number[]}>();
  for(const i of bundle.incomes){const k=String(i.income_date).slice(0,7);const g=monthMap.get(k)??{income:0,expense:0,incomeCount:0,expenseCount:0,expenses:[],incomes:[]};g.income+=num(i.amount);g.incomeCount++;g.incomes.push(num(i.amount));monthMap.set(k,g);}
  for(const e of bundle.expenses){const k=String(e.expense_date).slice(0,7);const g=monthMap.get(k)??{income:0,expense:0,incomeCount:0,expenseCount:0,expenses:[],incomes:[]};g.expense+=num(e.amount);g.expenseCount++;g.expenses.push(num(e.amount));monthMap.set(k,g);}
  const monthRows=[...monthMap.entries()].sort().map(([month,g])=>[month,g.income,g.expense,g.income-g.expense,g.incomeCount,g.expenseCount,g.expenses.length?g.expense/g.expenses.length:0,g.expenses.length?Math.max(...g.expenses):0,g.incomes.length?Math.max(...g.incomes):0]);
  addTable(monthly,'MonthlySummary',['Month','Total Income','Total Expenses','Net Income','Income Transactions','Expense Transactions','Average Expense','Largest Expense','Largest Income'],monthRows);
  [2,3,4,7,8,9].forEach(i=>setCurrencyColumn(monthly,i));

  const rawIncome=wb.addWorksheet('Raw Income');
  addTable(rawIncome,'RawIncome',['id','family_id','member_id','category_id','description','amount','income_date','notes','created_by','created_at'],bundle.incomes.map(i=>[i.id,i.family_id,i.member_id,i.category_id,i.description,num(i.amount),i.income_date,i.notes ?? '',i.created_by,i.created_at]));
  setCurrencyColumn(rawIncome,6);

  const rawExp=wb.addWorksheet('Raw Expenses');
  addTable(rawExp,'RawExpenses',['id','family_id','category_id','description','amount','expense_date','expense_type','payment_method','payment_account_id','notes','created_by','created_at','updated_at'],bundle.expenses.map(e=>[e.id,e.family_id,e.category_id,e.description,num(e.amount),e.expense_date,e.expense_type,e.payment_method ?? '',e.payment_account_id ?? '',e.notes ?? '',e.created_by,e.created_at,e.updated_at]));
  setCurrencyColumn(rawExp,5);

  const rawTransfers=wb.addWorksheet('Raw Transfers Loans');
  const rawRows=[
    ...bundle.transfers.map(t=>['Transfer',t.id,t.family_id,t.from_member_id,t.to_member_id,num(t.amount),t.date,t.purpose ?? '',t.notes ?? '',t.created_at]),
    ...bundle.loans.map(l=>['Loan',l.id,l.family_id,l.from_member_id,l.to_member_id,num(l.principal),l.due_date ?? '',l.status,l.notes ?? '',l.created_at])
  ];
  addTable(rawTransfers,'RawTransfersLoans',['Record Type','id','family_id','from_member_id','to_member_id','amount_or_principal','date_or_due_date','purpose_or_status','notes','created_at'],rawRows);
  setCurrencyColumn(rawTransfers,6);

  return wb;
}

export async function downloadLedgerlyWorkbook(bundle:ExportBundle) {
  await loadExcelJS();
  const workbook = buildLedgerlyWorkbook(bundle);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;
  a.download='Ledgerly_Data_Export.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
