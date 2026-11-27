import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGetMeQuery, useUpdateMeMutation } from '../../services/api/users';
import { Screen, ScreenHeader, Card, ColorSwatchPicker, AppButton, SectionTitle, Muted } from '../../components/ui';
import { DEFAULT_ACCENT } from '../../components/theme';
import { isValidHex, normalizeHex } from '../../utils/colors';

// Personal context management (ADR-028): color only — no rename, members or delete. The color lives on the account
// (PATCH /users/me), so it follows the user to every device. "Default" saves null.
export default function PersonalScreen() {
  const { t } = useTranslation();
  const { data: me } = useGetMeQuery();
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  const saved = (me?.color && normalizeHex(me.color)) || DEFAULT_ACCENT;
  const [color, setColor] = useState(saved);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setColor(saved);
    setInvalid(false);
  }, [saved]);

  const save = async (next) => {
    try {
      await updateMe({ color: next }).unwrap();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };
  const onSave = () => {
    const hex = normalizeHex(color);
    if (!isValidHex(color) || !hex) return setInvalid(true);
    setInvalid(false);
    return save(hex);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={t('teams.personalName')} />
      <SectionTitle>{t('teams.personalColor')}</SectionTitle>
      <Card>
        <ColorSwatchPicker
          value={color}
          onChange={(next) => {
            setColor(next);
            setInvalid(false);
          }}
        />
        {invalid ? <Muted>{t('teams.invalidColor')}</Muted> : null}
        {color !== saved ? <AppButton title={t('common.save')} onPress={onSave} loading={isLoading} /> : null}
        {me?.color ? <AppButton title={t('teams.colorDefault')} variant="ghost" onPress={() => save(null)} disabled={isLoading} /> : null}
      </Card>
      <Muted>{t('teams.personalHint')}</Muted>
    </Screen>
  );
}
