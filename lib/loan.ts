export type LoanCalculation = {
  principal: number;
  annualRate: number;
  months: number;
  emi: number;
  totalInterest: number;
  totalRepayment: number;
  firstMonthInterest: number;
  firstMonthPrincipal: number;
};

export function calculateLoan(principalInput: number, annualRateInput: number, monthsInput: number): LoanCalculation {
  const principal = Math.max(0, Number(principalInput) || 0);
  const annualRate = Math.max(0, Number(annualRateInput) || 0);
  const months = Math.max(0, Math.floor(Number(monthsInput) || 0));

  if (!principal || !months) {
    return { principal, annualRate, months, emi: 0, totalInterest: 0, totalRepayment: 0, firstMonthInterest: 0, firstMonthPrincipal: 0 };
  }

  if (annualRate === 0) {
    const emi = principal / months;
    return { principal, annualRate, months, emi, totalInterest: 0, totalRepayment: principal, firstMonthInterest: 0, firstMonthPrincipal: emi };
  }

  const monthlyRate = annualRate / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, months);
  const emi = principal * monthlyRate * factor / (factor - 1);
  const firstMonthInterest = principal * monthlyRate;
  const firstMonthPrincipal = Math.max(0, emi - firstMonthInterest);
  const totalRepayment = emi * months;

  return {
    principal,
    annualRate,
    months,
    emi,
    totalInterest: Math.max(0, totalRepayment - principal),
    totalRepayment,
    firstMonthInterest,
    firstMonthPrincipal,
  };
}
