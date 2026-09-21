export function validateSettlementPayment(paid: number, obligation: number): void {
  if (!Number.isFinite(obligation) || obligation <= 0) throw new Error('Obligation must be greater than 0.');
  if (!Number.isFinite(paid) || paid <= 0) throw new Error('Payment must be greater than 0.');
  if (paid > obligation + 0.000001) throw new Error('Payment cannot exceed the obligation.');
}
export function validateDifferentMembers(from: string, to: string): void {
  if (!from || !to || from === to) throw new Error('Members must be different.');
}
