export type SplitMode = 'single' | 'equal' | 'custom' | 'percentage';

export type Allocation = {
  member_id: string;
  amount: number;
  percentage?: number;
};

export function allocateExpense(
  amount: number,
  memberIds: string[],
  mode: SplitMode,
  custom: Record<string, string | number> = {},
  percentages: Record<string, string | number> = {}
): Allocation[] {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0.');
  const ids = [...new Set(memberIds.filter(Boolean))];
  if (!ids.length) throw new Error('At least one member is required.');

  const cents = Math.round(amount * 100);

  if (mode === 'single') {
    return [{ member_id: ids[0], amount: cents / 100 }];
  }

  if (mode === 'equal') {
    const base = Math.floor(cents / ids.length);
    const remainder = cents - base * ids.length;
    return ids.map((member_id, i) => ({
      member_id,
      amount: (base + (i === ids.length - 1 ? remainder : 0)) / 100
    }));
  }

  if (mode === 'custom') {
    const allocations = ids.map(member_id => ({
      member_id,
      amount: Math.round(Number(custom[member_id] || 0) * 100) / 100
    }));
    validateTotal(amount, allocations.reduce((s, a) => s + a.amount, 0));
    return allocations;
  }

  const pcts = ids.map(id => Number(percentages[id] || 0));
  if (Math.abs(pcts.reduce((a, b) => a + b, 0) - 100) > 0.001) {
    throw new Error('Percentages must total 100%.');
  }

  let used = 0;
  return ids.map((member_id, i) => {
    const share = i === ids.length - 1
      ? cents - used
      : Math.floor(cents * pcts[i] / 100);
    used += share;
    return { member_id, amount: share / 100, percentage: pcts[i] };
  });
}

export function validateTotal(expected: number, actual: number): void {
  if (Math.abs(Math.round(expected * 100) - Math.round(actual * 100)) > 0) {
    throw new Error('Allocation total does not match expense amount.');
  }
}
