import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAddVaultMutation } from '../../../src/services/api/vaults';
import { Screen, Field, AppButton, Muted } from '../../../src/components/ui';
import { spacing } from '../../../src/components/theme';

export default function NewVault() {
  const router = useRouter();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [addVault, { isLoading, error }] = useAddVaultMutation();

  const submit = async () => {
    if (!name.trim()) return;
    const body = { name: name.trim() };
    if (target !== '' && Number(target) > 0) body.target_amount = Number(target);
    try {
      await addVault(body).unwrap();
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
