export function formatMoney(
  amount: number | null | undefined,
  currency: string,
  priceLabel?: string | null,
) {
  if (amount == null) return priceLabel || '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function quantityFor(itemId: number, lines: { menuItemId: number, quantity: number }[]) {
  return lines.find(line => line.menuItemId === itemId)?.quantity ?? 0
}
