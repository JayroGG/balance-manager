import { Text } from 'react-native';
import { formatMoney } from '../../utils/money';
import { useTheme } from '../../hooks/useTheme';

// `signed`: a negative amount paints in the theme danger color (ADR-022). Opt-in so debts/expenses that are
// already red by design keep their own color; figures that CAN go below zero (available, total, net) pass it.
export const MoneyText = ({ amount, currency, style, showCurrency = true, signed = false }) => {
  const { colors } = useTheme();
  const negative = signed && Number(amount) < 0;
  return (
    <Text style={negative ? [style, { color: colors.danger }] : style}>
      {formatMoney(amount, currency, { showCurrency })}
    </Text>
  );
};
