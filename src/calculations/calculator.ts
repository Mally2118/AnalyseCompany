export const investmentLimits = { min: 10000, max: 1000000, step: 10000, initial: 100000 } as const;
export function allocation(amount: number, weight: number) {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(weight) ||
    amount < 0 ||
    weight < 0 ||
    weight > 1
  )
    throw new Error('Недопустимые сумма или вес');
  const SBER = amount * weight;
  return { SBER, T: amount - SBER };
}
