/** Thousands separators only. The amount stays the API decimal string. */
export function formatAmount(amount: string, currency: string): string {
  const dot = amount.indexOf(".");
  const whole = dot === -1 ? amount : amount.slice(0, dot);
  const fraction = dot === -1 ? "" : amount.slice(dot);
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = sign ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction} ${currency}`;
}
