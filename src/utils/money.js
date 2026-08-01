// The API speaks decimals and tells us the currency label (GET /balance). We only format. (PRD §4)
//
// `showCurrency` has three densities, because the peso and the dollar share the same narrow symbol:
//   true       — headline figures: symbol + national qualifier, e.g. `$1,234.50 M.N.`
//   'symbol'   — list rows: symbol only, e.g. `$1,234.50` (the screen already establishes which
//                currency; the qualifier repeated on every row is what ate the row width)
//   false      — bare grouped number, e.g. `1,234.50`
//
// M.N. = "moneda nacional", the Mexican convention for marking pesos as distinct from other
// $-symbol currencies. Only currencies that are genuinely ambiguous need an entry here.
const QUALIFIERS = { MXN: 'M.N.' };

export const formatMoney = (amount, currency = 'USD', options = {}) => {
  const { showCurrency = true } = options;
  const value = Number(amount ?? 0);
  try {
    if (!showCurrency) {
      return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    }
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(value);
    const qualifier = showCurrency === true ? QUALIFIERS[currency] : undefined;
    return qualifier ? `${formatted} ${qualifier}` : formatted;
  } catch {
    return showCurrency ? `${currency} ${value.toFixed(2)}` : value.toFixed(2);
  }
};
