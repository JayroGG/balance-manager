import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddVaultMutation } from '../../services/api/vaults';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Screen, ScreenHeader, Field, AppButton, Muted } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../components/theme';

export default function NewVault() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const teamId = useActiveTeamId();
  const { canAdd } = usePermissions();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [addVault, { isLoading, error }] = useAddVaultMutation();
  // Drop the half-filled form if the context switches — it would create in the wrong context.
  useDismissOnContextChange();

  // Guard the deep-link path: the FAB is already hidden when the user can't add (ADR-012).
  if (!canAdd) return <Redirect href="/(tabs)/vaults" />;

  const submit = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim() };
    if (target !== '' && Number(target) > 0) body.target_amount = Number(target);
    try {
      await addVault({ ...body, team_id: teamId }).unwrap();
      router.back();
    } catch {}
  };

  return (
    <Screen>
      <ScreenHeader back title={t('vaults.new')} />
      <View>
        <Field label={t('vaults.name')} value={name} onChangeText={setName} placeholder="—" />
        <Field
          label={t('vaults.targetAmount')}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        {error ? <Muted style={{ color: colors.danger, marginBottom: spacing(1.5) }}>{error.message}</Muted> : null}
        <AppButton title={t('common.create')} onPress={submit} loading={isLoading} disabled={!name.trim()} />
      </View>
    </Screen>
  );
}
