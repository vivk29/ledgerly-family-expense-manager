// Ledgerly Excel export. Dependency-free OOXML writer so production builds do not depend on ExcelJS.
export interface ExportBundle {
  family:any; members:any[]; categories:any[]; incomes:any[]; expenses:any[];
  paymentAccounts:any[]; transfers:any[]; loans:any[]; exportedBy:string; exportedAt:string;
}

const esc=(v:any)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const num=(v:any)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const memberName=(ms:any[],id:any)=>ms.find(m=>m.id===id)?.name??'N/A';
const categoryName=(cs:any[],id:any)=>cs.find(c=>c.id===id)?.name??'N/A';
const accountLabel=(as:any[],id:any)=>{const a=as.find(x=>x.id===id);return a?a.name+' ('+(a.account_type==='credit_card'?'Credit Card':a.account_type==='bank_account'?'Bank Account':a.account_type==='debit_card'?'Debit Card':'UPI')+')':'N/A'};
const purposeLabel=(p:any)=>p==='home_expense'?'Home expenses (track only)':p==='personal'?'Personal / reimbursement':p==='loan'?'Loan':p??'N/A';
const date=(v:any)=>{if(!v)return'N/A';const [y,m,d]=String(v).split('-');return y&&m&&d?d+'-'+m+'-'+y:String(v)};
const timestamp=(v:any)=>{if(!v)return'N/A';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);const p=(n:number)=>String(n).padStart(2,'0');return p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes())};
const colName=(n:number)=>{let s='';while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s};
const xml=(s:string)=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${s}`;

function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function u16(n:number){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n:number){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concat(parts:Uint8Array[]){const n=parts.reduce((s,p)=>s+p.length,0);const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}

function zip(files:{name:string,data:string}[]){
  const enc=new TextEncoder(), local:Uint8Array[]=[], central:Uint8Array[]=[];let offset=0;
  for(const f of files){const name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    const lh=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    local.push(lh);
    const ch=concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    central.push(ch);offset+=lh.length;
  }
  const cd=concat(central), body=concat(local), end=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(cd.length),u32(body.length),u16(0)]);
  return concat([body,cd,end]);
}

type Sheet={name:string;headers:string[];rows:any[][];currency?:number[];percent?:number[];date?:number[];note?:string;title?:string};
const tableName=(i:number)=>'LedgerlyTable'+i;

function stylesXml(){return xml(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="16"/><name val="Aptos"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6340"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F7F4"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;₹&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="0.00%"/><numFmt numFmtId="166" formatCode="dd-mm-yyyy"/></numFmts>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)}

function cell(v:any,style=0){
  if(v&&typeof v==='object'&&'formula'in v)return `<c s="${style}"><f>${esc(v.formula)}</f><v>0</v></c>`;
  if(typeof v==='number')return `<c s="${style}" t="n"><v>${Number.isFinite(v)?v:0}</v></c>`;
  return `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}
function sheetXml(sheet:Sheet,index:number,table?:{ref:string,name:string}){
  const cols=sheet.headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="18" customWidth="1"/>`).join('');
  const rows:any[][]=[sheet.headers,...sheet.rows];
  const body=rows.map((r,ri)=>'<row r="'+(ri+1)+'">'+r.map((v,ci)=>{
    let st=ri===0?1:0;
    if(ri>0&&sheet.currency?.includes(ci+1)&&typeof v==='number')st=2;
    if(ri>0&&sheet.date?.includes(ci+1)&&typeof v==='number')st=3;
    if(ri>0&&sheet.percent?.includes(ci+1)&&typeof v==='number')st=4;
    return cell(v,st);
  }).join('')+'</row>').join('');
  const pane=sheet.headers.length?`<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`:'';
  const tablePart=table?`<tableParts count="1"><tablePart r:id="rId1"/></tableParts>`:''; 
  const note=sheet.note&&!sheet.rows.length?`<mergeCells count="1"><mergeCell ref="A2:${colName(Math.max(1,sheet.headers.length))}2"/></mergeCells>`:'';
  const noteRow=sheet.note&&!sheet.rows.length?`<row r="2"><c s="6" t="inlineStr"><is><t>${esc(sheet.note)}</t></is></c></row>`:''; 
  return xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols>${cols}</cols>${pane}<sheetData>${body}${noteRow}</sheetData>${note}${tablePart}</worksheet>`);
}
function tableXml(ref:string,name:string,headers:string[],id:number){return xml(`<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${name}" displayName="${name}" ref="${ref}"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((h,i)=>`<tableColumn id="${i+1}" name="${esc(h)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`)}

function workbookFiles(sheets:Sheet[]){
  const files:{name:string;data:string}[]=[];
  const overrides=[`<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`];
  const rels:string[]=[];
  sheets.forEach((s,i)=>{const n=i+1;overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);rels.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`)});
  const tableCount=sheets.filter(s=>s.rows.length).length;let ti=0;
  sheets.forEach((s,i)=>{if(s.rows.length){ti++;overrides.push(`<Override PartName="/xl/tables/table${ti}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`)}});

  files.push({name:'[Content_Types].xml',data:xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join('')}</Types>`)});
  files.push({name:'_rels/.rels',data:xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')});
  files.push({name:'xl/workbook.xml',data:xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`)});
  files.push({name:'xl/_rels/workbook.xml.rels',data:xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)});
  files.push({name:'xl/styles.xml',data:stylesXml()});
  ti=0;
  sheets.forEach((s,i)=>{const n=i+1;let table;let rel='';if(s.rows.length){ti++;const ref=`A1:${colName(s.headers.length)}${s.rows.length+1}`;const tn=tableName(ti);table={ref,name:tn};files.push({name:`xl/tables/table${ti}.xml`,data:tableXml(ref,tn,s.headers,ti)});rel=xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${ti}.xml"/></Relationships>`);files.push({name:`xl/worksheets/_rels/sheet${n}.xml.rels`,data:rel})}files.push({name:`xl/worksheets/sheet${n}.xml`,data:sheetXml(s,n,table)})});
  return files;
}

export async function fetchExportBundle(supabase:any,familyId:string,exportedBy:string):Promise<ExportBundle>{
  const [family,members,categories,incomes,expenses,paymentAccounts,transfers,loans]=await Promise.all([
    supabase.from('families').select('id,name,family_code,created_by,created_at').eq('id',familyId).single(),
    supabase.from('family_members').select('id,family_id,user_id,name,email,income_monthly,budget_monthly,is_active,created_at').eq('family_id',familyId).order('created_at'),
    supabase.from('categories').select('id,family_id,name,kind,created_at,is_active').eq('family_id',familyId).order('kind').order('name'),
    supabase.from('incomes').select('id,family_id,member_id,category_id,description,amount,income_date,notes,created_by,created_at').eq('family_id',familyId).order('income_date'),
    supabase.from('expenses').select('id,family_id,category_id,description,amount,expense_date,expense_type,payment_method,payment_account_id,notes,created_by,created_at,updated_at,expense_payers(member_id,amount),expense_allocations(member_id,amount,percentage)').eq('family_id',familyId).is('deleted_at',null).order('expense_date'),
    supabase.from('payment_accounts').select('id,family_id,member_id,account_type,name,is_active,created_at').eq('family_id',familyId).order('created_at'),
    supabase.from('family_transfers').select('id,family_id,from_member_id,to_member_id,amount,date,notes,purpose,created_at').eq('family_id',familyId).order('date'),
    supabase.from('family_loans').select('id,family_id,name,principal,outstanding,from_member_id,to_member_id,due_date,status,notes,created_at').eq('family_id',familyId).order('created_at')
  ]);
  const all=[family,members,categories,incomes,expenses,paymentAccounts,transfers,loans];const errors=all.filter(x=>x.error);if(errors.length)throw new Error(errors.map(x=>x.error.message).join('; '));
  return {family:family.data,members:members.data??[],categories:categories.data??[],incomes:incomes.data??[],expenses:expenses.data??[],paymentAccounts:paymentAccounts.data??[],transfers:transfers.data??[],loans:loans.data??[],exportedBy,exportedAt:new Date().toISOString()};
}

export function buildLedgerlyXlsx(bundle:ExportBundle){
  const incomeRows=bundle.incomes.map(i=>[i.id,date(i.income_date),memberName(bundle.members,i.member_id),i.member_id??'N/A',num(i.amount),categoryName(bundle.categories,i.category_id),i.description,i.notes??'',timestamp(i.created_at),'N/A']);
  const expenseRows:any[][]=[];
  for(const e of bundle.expenses){const p=e.expense_payers?.[0]??{member_id:null,amount:e.amount};const as=e.expense_allocations?.length?e.expense_allocations:[{member_id:null,amount:e.amount}];for(const a of as)expenseRows.push([e.id,date(e.expense_date),e.description,num(e.amount),categoryName(bundle.categories,e.category_id),'N/A',memberName(bundle.members,p.member_id),p.member_id??'N/A',memberName(bundle.members,a.member_id),a.member_id??'N/A',num(a.amount),e.payment_method??'N/A',accountLabel(bundle.paymentAccounts,e.payment_account_id),e.payment_account_id??'N/A',e.notes??'',timestamp(e.created_at),timestamp(e.updated_at)])}
  const dates=[...bundle.incomes.map(x=>x.income_date),...bundle.expenses.map(x=>x.expense_date)].filter(Boolean).sort();
  const sheets:Sheet[]=[];
  sheets.push({name:'Overview',headers:['Metric','Value'],rows:[
    ['Family Name',bundle.family?.name??'N/A'],['Export Date/Time',timestamp(bundle.exportedAt)],['Exported By',bundle.exportedBy||'N/A'],
    ['Total Family Members',bundle.members.length],['Total Income',{formula:'SUM(Income!E2:E1048576)'}],['Total Expenses',{formula:'SUM(Expenses!D2:D1048576)'}],['Net Amount / Balance',{formula:'B6-B7'}],
    ['Total Transactions',bundle.incomes.length+bundle.expenses.length],['Income Transactions',bundle.incomes.length],['Expense Transactions',bundle.expenses.length],['Payment Accounts',bundle.paymentAccounts.length],
    ['Date Range Covered',dates.length?date(dates[0])+' to '+date(dates[dates.length-1]):'No transactions']
  ],currency:[2]});
  sheets.push({name:'Family Members',headers:['Member ID','Name','Email','Role','User ID','Status','Created At','Updated At'],rows:bundle.members.map(m=>[m.id,m.name,m.email??'N/A','N/A',m.user_id??'N/A',m.is_active?'Active':'Archived',timestamp(m.created_at),'N/A'])});
  sheets.push({name:'Income',headers:['Income ID','Date','Member','Member ID','Amount','Category','Description','Notes','Created At','Updated At'],rows:incomeRows,currency:[5],note:incomeRows.length?'': 'No records available'});
  sheets.push({name:'Expenses',headers:['Expense ID','Date','Description','Amount','Category','Subcategory','Who Paid','Payer Member ID','Who Will Pay / Responsible','Responsible Member ID','Allocated Amount','Payment Method','Payment Account','Payment Account ID','Notes','Created At','Updated At'],rows:expenseRows,currency:[4,11],note:expenseRows.length?'':'No records available'});
  sheets.push({name:'Payment Accounts',headers:['Account ID','Family ID','Member ID','Member Name','Account Type','Account/Card Name','Active','Created At'],rows:bundle.paymentAccounts.map(a=>[a.id,a.family_id,a.member_id,memberName(bundle.members,a.member_id),a.account_type==='credit_card'?'Credit Card':a.account_type==='bank_account'?'Bank Account':a.account_type==='debit_card'?'Debit Card':'UPI',a.name,a.is_active?'Active':'Inactive',timestamp(a.created_at)]),note:bundle.paymentAccounts.length?'':'No records available'});
  const ledger=[...bundle.incomes.map(i=>[i.id,'Income',date(i.income_date),memberName(bundle.members,i.member_id),i.member_id??'N/A',i.description,categoryName(bundle.categories,i.category_id),num(i.amount),'N/A','N/A','N/A','N/A',i.notes??'']),...expenseRows.map(e=>[e[0],'Expense',e[1],e[6],e[7],e[2],e[4],e[3],e[11],e[12],e[6],e[8],e[14]])].sort((a,b)=>String(a[2]).localeCompare(String(b[2])));
  sheets.push({name:'Transactions',headers:['Transaction ID','Transaction Type','Date','Member / Payer','Member ID','Description','Category','Amount','Payment Method','Payment Account','Who Paid','Who Is Responsible','Notes'],rows:ledger,currency:[8],note:ledger.length?'':'No records available'});
  const catRows:any[][]=[];for(const kind of ['income','expense']){const src=kind==='income'?bundle.incomes.map(i=>({d:i.income_date,c:i.category_id,a:num(i.amount)})):bundle.expenses.flatMap(e=>(e.expense_allocations?.length?e.expense_allocations:[{amount:e.amount}]).map((a:any)=>({d:e.expense_date,c:e.category_id,a:num(a.amount)})));const map=new Map<string,any>();for(const x of src){const k=x.c??'N/A';const g=map.get(k)??{n:0,t:0,min:x.d,max:x.d};g.n++;g.t+=x.a;if(x.d<g.min)g.min=x.d;if(x.d>g.max)g.max=x.d;map.set(k,g)}const total=src.reduce((s,x)=>s+x.a,0);for(const[k,g]of map)catRows.push([kind==='income'?'Income':'Expense',categoryName(bundle.categories,k),g.n,g.t,total?g.t/total:0,date(g.min)+' to '+date(g.max)])}
  sheets.push({name:'Categories',headers:['Transaction Type','Category','Number of Transactions','Total Amount','Percentage of Total','Date Range'],rows:catRows,currency:[4],percent:[5],note:catRows.length?'':'No records available'});
  const memberRows=bundle.members.map(m=>{const inc=bundle.incomes.filter(i=>i.member_id===m.id);const paid=bundle.expenses.filter(e=>e.expense_payers?.some((p:any)=>p.member_id===m.id));const responsible=bundle.expenses.reduce((s,e)=>s+(e.expense_allocations??[]).filter((a:any)=>a.member_id===m.id).reduce((x:number,a:any)=>x+num(a.amount),0),0);const methods=['Bank Transfer','Credit Card','Debit Card','UPI','Cash','Other'].map(pm=>paid.filter(e=>e.payment_method===pm).reduce((s,e)=>s+num(e.amount),0));return[m.name,inc.reduce((s,i)=>s+num(i.amount),0),paid.reduce((s,e)=>s+num(e.amount),0),responsible,inc.length,paid.length,...methods]});
  sheets.push({name:'Member Summary',headers:['Member','Total Income','Total Expenses Paid','Total Expenses Responsible','Income Entries','Expense Entries','Bank Transfer','Credit Card','Debit Card','UPI','Cash','Other'],rows:memberRows,currency:[2,3,4,7,8,9,10,11,12]});
  const pms=['Cash','Bank Transfer','Credit Card','Debit Card','UPI','Other'];const grand=bundle.expenses.reduce((s,e)=>s+num(e.amount),0);const pmRows=pms.map(pm=>{const rs=bundle.expenses.filter(e=>e.payment_method===pm);const t=rs.reduce((s,e)=>s+num(e.amount),0);return[pm,rs.length,t,grand?t/grand:0,new Set(rs.map(e=>e.payment_account_id).filter(Boolean)).size]}).filter(r=>r[1]);
  sheets.push({name:'Payment Methods',headers:['Payment Method','Number of Transactions','Total Amount','Percentage of Expenses','Number of Different Accounts Used'],rows:pmRows,currency:[3],percent:[4],note:pmRows.length?'':'No records available'});
  const trRows=bundle.transfers.map(t=>[t.id,date(t.date),t.notes??'N/A',num(t.amount),memberName(bundle.members,t.from_member_id),memberName(bundle.members,t.to_member_id),purposeLabel(t.purpose),t.from_member_id,t.to_member_id,t.purpose==='home_expense'?'No balance effect (tracking only)':'Affects balance',t.notes??'']);
  sheets.push({name:'Transfer Details',headers:['Transfer ID','Date','Description / Notes','Amount','Who Paid / From','Who Is Responsible / To','Transfer Purpose','From Member ID','To Member ID','Balance Effect','Notes'],rows:trRows,currency:[4],note:trRows.length?'':'No records available'});
  const loanRows=bundle.loans.map(l=>[l.id,l.name,num(l.principal),l.outstanding==null?'N/A':num(l.outstanding),memberName(bundle.members,l.from_member_id),memberName(bundle.members,l.to_member_id),l.due_date?date(l.due_date):'N/A',l.status,l.notes??'',timestamp(l.created_at)]);
  sheets.push({name:'Family Loans',headers:['Loan ID','Name','Principal','Outstanding','From Member','To Member','Due Date','Status','Notes','Created At'],rows:loanRows,currency:[3,4],note:loanRows.length?'':'No records available'});
  const mm=new Map<string,any>();for(const i of bundle.incomes){const k=String(i.income_date).slice(0,7),g=mm.get(k)??{i:0,e:0,ic:0,ec:0,es:[],is:[]};g.i+=num(i.amount);g.ic++;g.is.push(num(i.amount));mm.set(k,g)}for(const e of bundle.expenses){const k=String(e.expense_date).slice(0,7),g=mm.get(k)??{i:0,e:0,ic:0,ec:0,es:[],is:[]};g.e+=num(e.amount);g.ec++;g.es.push(num(e.amount));mm.set(k,g)}
  const mon=[...mm.entries()].sort().map(([m,g])=>[m,g.i,g.e,g.i-g.e,g.ic,g.ec,g.es.length?g.e/g.ec:0,g.es.length?Math.max(...g.es):0,g.is.length?Math.max(...g.is):0]);
  sheets.push({name:'Monthly Summary',headers:['Month','Total Income','Total Expenses','Net Income','Income Transactions','Expense Transactions','Average Expense','Largest Expense','Largest Income'],rows:mon,currency:[2,3,4,7,8,9]});
  sheets.push({name:'Raw Income',headers:['id','family_id','member_id','category_id','description','amount','income_date','notes','created_by','created_at'],rows:bundle.incomes.map(i=>[i.id,i.family_id,i.member_id,i.category_id,i.description,num(i.amount),i.income_date,i.notes??'',i.created_by,i.created_at]),currency:[6]});
  sheets.push({name:'Raw Expenses',headers:['id','family_id','category_id','description','amount','expense_date','expense_type','payment_method','payment_account_id','notes','created_by','created_at','updated_at'],rows:bundle.expenses.map(e=>[e.id,e.family_id,e.category_id,e.description,num(e.amount),e.expense_date,e.expense_type,e.payment_method??'',e.payment_account_id??'',e.notes??'',e.created_by,e.created_at,e.updated_at]),currency:[5]});
  sheets.push({name:'Raw Transfers Loans',headers:['Record Type','id','family_id','from_member_id','to_member_id','amount_or_principal','date_or_due_date','purpose_or_status','notes','created_at'],rows:[...bundle.transfers.map(t=>['Transfer',t.id,t.family_id,t.from_member_id,t.to_member_id,num(t.amount),t.date,t.purpose??'',t.notes??'',t.created_at]),...bundle.loans.map(l=>['Loan',l.id,l.family_id,l.from_member_id,l.to_member_id,num(l.principal),l.due_date??'',l.status,l.notes??'',l.created_at])],currency:[6]});
  const files=workbookFiles(sheets);return zip(files);
}

export async function downloadLedgerlyWorkbook(bundle:ExportBundle){
  const bytes=buildLedgerlyXlsx(bundle);
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Ledgerly_Data_Export.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
