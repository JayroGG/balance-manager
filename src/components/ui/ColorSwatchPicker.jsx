import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PRESET_TEAM_COLORS, font, spacing } from '../theme';
import { useTheme } from '../../hooks/useTheme';
import { normalizeHex } from '../../utils/colors';
import { Field } from './Field';

// Team-color picker (ADR-013): 10 preset swatches fill the hex field; the field also takes a custom
// hex. Emits the raw text — the consumer validates/normalizes at save (boundary rule).
export const ColorSwatchPicker = ({ value, onChange, label }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const selected = normalizeHex(value);
  return (
    <View>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {PRESET_TEAM_COLORS.map((hex) => (
          <Pressable
            key={hex}
            testID={`swatch-${hex}`}
            onPress={() => onChange(hex)}
            style={[styles.swatch, { backgroundColor: hex }, selected === hex && styles.selected]}
          />
        ))}
      </View>
      <Field
        label={t('teams.colorHex')}
        value={value ?? ''}
        onChangeText={onChange}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="#RRGGBB"
      />
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
    swatch: {
      width: 32,
      height: 32,
      borderRadius: 999,
      marginRight: spacing(1),
      marginBottom: spacing(1),
    },
    selected: { borderWidth: 3, borderColor: colors.text },
  });
