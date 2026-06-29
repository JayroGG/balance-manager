import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddVaultMutation } from '../../services/api/vaults';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { useDismissOnContextChange } from '../../hooks/useOnContextChange';
import { usePermissions } from '../../permissions';
import { Screen, Field, AppButton, Muted } from '../../components/ui';
import { spacing } from '../../components/theme';

export default function NewVault() {
  const router = useRouter();
  const { t } = useTranslation();
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
      <View style={{ paddingTop: spacing(2) }}>
        <Field label={t('vaults.name')} value={name} onChangeText={setName} placeholder="—" />
        <Field
          label={t('vaults.targetAmount')}
          value={target}
          onChangeText={setTarget}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        {error ? <Muted style={{ color: '#DC2626', marginBottom: spacing(1.5) }}>{error.message}</Muted> : null}
        <AppButton title={t('common.create')} onPress={submit} loading={isLoading} disabled={!name.trim()} />
      </View>
    </Screen>
  );
}
