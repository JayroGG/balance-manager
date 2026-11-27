import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGetMeQuery, useUpdateMeMutation } from '../../services/api/users';
import { Screen, ScreenHeader, Card, Chip, ColorSwatchPicker, AppButton, SectionTitle, Muted } from '../../components/ui';
import { isValidHex, normalizeHex } from '../../utils/colors';

// Personal context management (ADR-028): color only — no rename, members or delete. The color lives on the account
// (PATCH /users/me), so it follows the user to every device. "Default" saves null.
export default function PersonalScreen() {
  const { t } = useTranslation();
  const { data: me } = useGetMeQuery();
  const [updateMe, { isLoading }] = useUpdateMeMutation();

  // null = the client default accent (what a null account color means)
  const saved = (me?.color && normalizeHex(me.color)) || null;
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
    if (color === null) return save(null);
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
        <View style={{ flexDirection: 'row' }}>
          <Chip label={t('teams.colorDefault')} active={color === null} onPress={() => { setColor(null); setInvalid(false); }} />
        </View>
        <ColorSwatchPicker
          value={color ?? ''}
          onChange={(next) => {
            setColor(next);
            setInvalid(false);
          }}
        />
        {invalid ? <Muted>{t('teams.invalidColor')}</Muted> : null}
        {color !== saved ? <AppButton title={t('common.save')} onPress={onSave} loading={isLoading} /> : null}
      </Card>
      <Muted>{t('teams.personalHint')}</Muted>
    </Screen>
  );
}
