// The API speaks decimals and tells us the currency label (GET /balance). We only format. (PRD §4)
export const formatMoney = (amount, currency = 'USD') => {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};
