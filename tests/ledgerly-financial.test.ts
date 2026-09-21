import { describe, expect, it } from 'vitest';
import { allocateExpense } from '../lib/split';
import { minimizeTransfers } from '../lib/settlement';
import { validateDifferentMembers, validateSettlementPayment } from '../lib/validators';

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
