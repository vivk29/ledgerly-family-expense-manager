import { describe, expect, it } from 'vitest';
import { allocateExpense } from '../lib/split';
import { minimizeTransfers } from '../lib/settlement';
import { validateDifferentMembers, validateSettlementPayment } from '../lib/validators';
import { buildLedgerlyXlsx } from '../lib/export';

describe('Ledgerly split allocation', () => {
  it('splits ₹100 equally across 3 members with exact paise', () => {
    expect(allocateExpense(100, ['a','b','c'], 'equal').map(x=>x.amount)).toEqual([33.33,33.33,33.34]);
  });
  it('supports custom amounts', () => {
    expect(allocateExpense(100,['a','b','c'],'custom',{a:'40',b:'35',c:'25'}).map(x=>x.amount)).toEqual([40,35,25]);
  });
  it('supports percentages and puts rounding remainder on the final member', () => {
    const r=allocateExpense(100,['a','b','c'],'percentage',{}, {a:40,b:35,c:25});
    expect(r.map(x=>x.amount)).toEqual([40,35,25]);
    expect(r.reduce((s,x)=>s+x.amount,0)).toBe(100);
  });
  it('rejects percentage totals other than 100', () => {
    expect(()=>allocateExpense(100,['a','b'],'percentage',{}, {a:60,b:30})).toThrow();
  });
  it('rejects custom totals that do not equal the expense', () => {
    expect(()=>allocateExpense(100,['a','b'],'custom',{a:40,b:30})).toThrow();
  });
});

describe('Ledgerly settlement calculations', () => {
  it('minimizes a simple two-party settlement', () => {
    expect(minimizeTransfers([
      {id:'a',name:'A',is_active:true,net:-60},
      {id:'b',name:'B',is_active:true,net:60}
    ])).toMatchObject([{fromId:'a',toId:'b',amount:60}]);
  });
  it('creates the expected two transfers for three members', () => {
    const r=minimizeTransfers([
      {id:'a',name:'A',is_active:true,net:-80},
      {id:'b',name:'B',is_active:true,net:30},
      {id:'c',name:'C',is_active:true,net:50}
    ]);
    expect(r).toHaveLength(2);
    expect(r.reduce((s,x)=>s+x.amount,0)).toBe(80);
  });
});

describe('Ledgerly validation', () => {
  it('rejects overpayment and accepts partial/full payment', () => {
    expect(()=>validateSettlementPayment(101,100)).toThrow();
    expect(()=>validateSettlementPayment(50,100)).not.toThrow();
    expect(()=>validateSettlementPayment(100,100)).not.toThrow();
  });
  it('rejects transfers or loans between the same member', () => {
    expect(()=>validateDifferentMembers('a','a')).toThrow();
    expect(()=>validateDifferentMembers('a','b')).not.toThrow();
  });
});


describe('Ledgerly Excel export', () => {
  it('builds a valid OOXML zip with unique table ids and expected sheets/formula', () => {
    const bytes = buildLedgerlyXlsx({
      family:{id:'f1',name:'Test\u0001 Family'},
      members:[{id:'m1',name:'Vivek'}],
      categories:[{id:'c1',name:'Salary',kind:'income'}],
      incomes:[{id:'i1',member_id:'m1',category_id:'c1',amount:1000,income_date:'2026-10-01',description:'Salary'}],
      expenses:[],
      paymentAccounts:[],
      transfers:[],
      loans:[],
      exportedBy:'test@example.com',
      exportedAt:'2026-10-04T12:00:00.000Z'
    });
    const xmlText = new TextDecoder().decode(bytes);
    expect(xmlText.startsWith('PK')).toBe(true);
    expect(xmlText).toContain('Overview');
    expect(xmlText).toContain('Raw Transfers Loans');
    expect(xmlText).toContain('<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>');
    expect(xmlText).toContain('<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>');
    expect(xmlText).toContain('<dimension ref="A1:B13"/>');
    expect(xmlText).not.toContain('Test\u0001 Family');
    expect(xmlText).toMatch(/<sheetViews>[\s\S]*<sheetFormatPr[^>]*\/><cols>[\s\S]*<sheetData>/);
    expect(xmlText).toContain('SUM(Income!E2:E1048576)');
    const ids = [...xmlText.matchAll(/<table[^>]* id="(\d+)"/g)].map(m=>m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
