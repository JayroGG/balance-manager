// The API speaks decimals and tells us the currency label (GET /balance). We only format. (PRD §4)
// `showCurrency: false` renders a bare grouped number (no symbol/code) for dense list rows where the
// currency is already established by the screen.
export const formatMoney = (amount, currency = 'USD', options = {}) => {
  const { showCurrency = true } = options;
  const value = Number(amount ?? 0);
  try {
    return showCurrency
      ? new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(value)
      : new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return showCurrency ? `${currency} ${value.toFixed(2)}` : value.toFixed(2);
  }
};
