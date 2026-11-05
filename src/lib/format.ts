const intFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const fmtInt = (n: number) => intFormat.format(Math.round(n));
export const fmt1 = (n: number) => oneDecimal.format(n);

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Parses a user-typed number, accepting a comma as decimal separator. */
export function parseNumber(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  return raw.trim() === '' || Number.isNaN(n) ? null : n;
}
