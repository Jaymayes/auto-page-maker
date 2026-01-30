export function formatTotalAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  if (amount < 1_000_000) {
    return amount.toLocaleString('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    });
  }
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}