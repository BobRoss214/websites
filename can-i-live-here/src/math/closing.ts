/**
 * Cash to close = down payment + closing costs + prepaids + reserves.
 *
 * Closing costs (buyer side, NC and SC are attorney-closing states):
 *  - Lender origination/underwriting: ~1.0% of loan (range 0.5-1%).
 *  - Appraisal ~$600, credit report/flood cert ~$100, attorney $1,000, title insurance (lender + owner)
 *    ~0.5% of price, recording ~$150, survey (optional) not included.
 *  ClosingCorp's last state-level report (2021) put NC at $2,642 and SC at $2,501 excluding transfer taxes,
 *  which both states charge the SELLER (NC excise $1 per $500, G.S. 105-228.30; SC deed recording fee $1.85 per
 *  $500). Our itemized estimate lands in the 2-3% range for typical loans, consistent with CFPB guidance (2-5%).
 * Prepaids: 3 months of property tax escrow, 12 months homeowners insurance + 2 months escrow cushion,
 *  15 days of prepaid interest (lender norm, Fannie Mae B2-1.3).
 * Reserves: 2 months of the full payment (a common lender overlay; conventional investment and VA/FHA manual
 *  underwriting often require 1-3 months).
 */
export interface ClosingInputs {
  price: number;
  loan: number;
  rate: number;
  annualTax: number;
  annualInsurance: number;
  monthlyPayment: number;
  upfrontFeeFinanced: boolean;
  upfrontFee: number;
}

export function closingCosts(inp: ClosingInputs): { closing: number; prepaids: number; reserves: number; items: { label: string; amount: number }[] } {
  const items = [
    { label: 'Lender fees (origination, underwriting)', amount: inp.loan * 0.01 },
    { label: 'Appraisal', amount: 600 },
    { label: 'Credit report and flood certification', amount: 100 },
    { label: 'Closing attorney', amount: 1000 },
    { label: 'Title insurance and search', amount: inp.price * 0.005 },
    { label: 'Recording fees', amount: 150 },
  ];
  if (!inp.upfrontFeeFinanced && inp.upfrontFee > 0) items.push({ label: 'Upfront loan fee paid in cash', amount: inp.upfrontFee });
  const closing = items.reduce((s, i) => s + i.amount, 0);
  const prepaidInterest = (inp.loan * inp.rate * 15) / 365;
  const prepaids = inp.annualTax * (3 / 12) + inp.annualInsurance * (14 / 12) + prepaidInterest;
  const reserves = inp.monthlyPayment * 2;
  return { closing, prepaids, reserves, items };
}
