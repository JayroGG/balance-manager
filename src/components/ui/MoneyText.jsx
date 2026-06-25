import { Text } from 'react-native';
import { formatMoney } from '../../utils/money';

export const MoneyText = ({ amount, currency, style }) => (
  <Text style={style}>{formatMoney(amount, currency)}</Text>
);
