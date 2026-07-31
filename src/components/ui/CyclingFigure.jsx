import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MoneyText } from './MoneyText';
import { spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';

// `steps`: [{ key, label, amount, color }] — one figure shown at a time, tap to advance to the next.
// `dotColor` is required from the consumer (never hardcoded — ADR-013): the hero sits on the accent
// (colors.primaryText) while the totals bar sits on a card (colors.muted), and the atom can't know which.
// The render index is clamped (`i % steps.length`) so a step list that shrinks between renders (e.g. the
// Lent step disappearing when a loan is fully repaid) can never index out of bounds.
export const CyclingFigure = ({
  steps, currency, showCurrency = true, labelStyle, valueStyle, dotColor, testID,
}) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [i, setI] = useState(0);

  if (!steps || steps.length === 0) return null;

  const index = steps.length ? i % steps.length : 0;
  const active = steps[index];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={active.label}
      onPress={() => setI((n) => n + 1)}
    >
      <Text style={labelStyle}>{active.label}</Text>
      <MoneyText
        amount={active.amount}
        currency={currency}
        showCurrency={showCurrency}
        style={[valueStyle, active.color ? { color: active.color } : null]}
      />
      {steps.length > 1 ? (
        <View style={styles.dots}>
          {steps.map((step, idx) => (
            <View
              key={step.key}
              style={[
                styles.dot,
                { backgroundColor: dotColor, opacity: idx === index ? 1 : 0.35 },
              ]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    dots: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(0.75), gap: spacing(0.75) },
    dot: { width: 6, height: 6, borderRadius: 999 },
  });
