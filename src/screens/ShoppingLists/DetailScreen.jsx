import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  useGetShoppingListQuery,
  useGetItemsQuery,
  useAddItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useCheckoutListMutation,
  useDeleteShoppingListMutation,
} from '../../services/api/shoppingLists';
import { useGetCategoriesQuery } from '../../services/api/categories';
import { useGetBalanceQuery } from '../../services/api/balance';
import { useActiveTeamId } from '../../hooks/useActiveTeamId';
import { usePermissions } from '../../permissions';
import { useTheme } from '../../hooks/useTheme';
import { Screen, ScreenHeader, Card, Field, AppButton, Chip, MoneyText, SectionTitle, Muted, QueryBoundary } from '../../components/ui';
import { font, spacing } from '../../components/theme';
import { formatMoney } from '../../utils/money';

// One shopping list: tick items off in-store, then checkout to post the expense (ADR-015). Editing is
// locked once the list is `purchased` (frozen history) or when RBAC says the row isn't the user's.
export default function ShoppingListDetail() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const teamId = useActiveTeamId();
  const { canEditRow } = usePermissions();

  const { data: list, isLoading, error, refetch } = useGetShoppingListQuery({ id, team_id: teamId });
  const { data: items } = useGetItemsQuery({ list_id: id, team_id: teamId });
  const { data: categories } = useGetCategoriesQuery(teamId);
  const { data: balance } = useGetBalanceQuery(teamId);
  const currency = balance?.currency;

  const [addItem, { isLoading: adding }] = useAddItemMutation();
  const [updateItem] = useUpdateItemMutation();
  const [deleteItem] = useDeleteItemMutation();
  const [checkout, { isLoading: checkingOut }] = useCheckoutListMutation();
  const [deleteList, { isLoading: deleting }] = useDeleteShoppingListMutation();

  const editable = list?.status === 'open' && canEditRow(list);

  // Add-item form
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');

  // Edit-item form
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Checkout form
  const [showCheckout, setShowCheckout] = useState(false);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [touched, setTouched] = useState(false);

  const estTotal = useMemo(
    () =>
      (items ?? [])
        .filter((it) => it.checked && it.price != null)
        .reduce((sum, it) => sum + Number(it.price) * (Number(it.qty) || 1), 0),
    [items],
  );
  const checkedCount = useMemo(() => (items ?? []).filter((it) => it.checked).length, [items]);

  const onAddItem = async () => {
    if (!itemName.trim()) return;
    const body = { list_id: id, name: itemName.trim(), team_id: teamId };
    if (price !== '' && Number(price) >= 0) body.price = Number(price);
    if (qty !== '' && Number(qty) > 0) body.qty = Number(qty);
    try {
      await addItem(body).unwrap();
      setItemName('');
      setPrice('');
      setQty('');
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const toggle = (item) =>
    updateItem({ id: item.id, list_id: id, team_id: teamId, checked: !item.checked });

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.qty != null ? String(item.qty) : '');
    setEditPrice(item.price != null ? String(item.price) : '');
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (item) => {
    if (!editName.trim()) return;
    const body = { id: item.id, list_id: id, team_id: teamId, name: editName.trim() };
    if (editQty !== '' && Number(editQty) > 0) body.qty = Number(editQty);
    if (editPrice === '') {
      body.price = null;
    } else if (Number(editPrice) >= 0) {
      body.price = Number(editPrice);
    }
    try {
      await updateItem(body).unwrap();
      setEditingId(null);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const openCheckout = () => {
    setAmount(estTotal > 0 ? String(estTotal.toFixed(2)) : '');
    setCategoryId(list?.category_id ?? null);
    setTouched(false);
    setShowCheckout(true);
  };

  const amountNum = Number(amount);
  const amountValid = amount !== '' && amountNum > 0;

  const onConfirmCheckout = async () => {
    setTouched(true);
    if (!amountValid) return;
    const body = { id, team_id: teamId, amount: amountNum };
    if (categoryId) body.category_id = categoryId;
    try {
      await checkout(body).unwrap();
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), e?.message ?? '');
    }
  };

  const onDelete = () => {
    Alert.alert(t('lists.deleteConfirm'), list?.name ?? '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteList({ id, team_id: teamId }).unwrap();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), e?.message ?? '');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <ScreenHeader back title={list?.name ?? t('lists.title')} />

      <QueryBoundary isLoading={isLoading && !list} error={error} onRetry={refetch}>
        {list?.status === 'purchased' ? (
          <Card>
            <Muted>{t('lists.frozenHint')}</Muted>
            {list.transaction_id ? (
              <Pressable
                style={styles.txLink}
                onPress={() => router.push(`/(tabs)/transactions/${list.transaction_id}`)}
              >
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                <Text style={styles.txLinkText}>{t('lists.viewTransaction')}</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        <SectionTitle>{t('lists.items')}</SectionTitle>
        {(items ?? []).length === 0 ? <Muted style={styles.hint}>{t('lists.noItems')}</Muted> : null}
        {(items ?? []).map((item) => (
          <Card key={item.id}>
            {editingId === item.id ? (
              <View>
                <Field
                  label={t('lists.itemName')}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('lists.itemName')}
                  testID={`edit-name-${item.id}`}
                />
                <View style={styles.inlineFields}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label={t('lists.qty')}
                      value={editQty}
                      onChangeText={setEditQty}
                      keyboardType="decimal-pad"
                      placeholder="1"
                      testID={`edit-qty-${item.id}`}
                    />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Field
                      label={t('lists.price')}
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      testID={`edit-price-${item.id}`}
                    />
                  </View>
                </View>
                <View style={styles.inlineFields}>
                  <View style={{ flex: 1 }}>
                    <AppButton
                      title={t('common.save')}
                      onPress={() => saveEdit(item)}
                      disabled={!editName.trim()}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppButton title={t('common.cancel')} variant="ghost" onPress={cancelEdit} />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.rowBetween}>
                <Pressable
                  style={styles.itemMain}
                  disabled={!editable}
                  onPress={() => toggle(item)}
                  testID={`item-toggle-${item.id}`}
                >
                  <Ionicons
                    name={item.checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.checked ? colors.primary : colors.muted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, item.checked && styles.itemChecked]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.price != null ? (
                      <Text style={styles.itemMeta}>
                        {(Number(item.qty) || 1) > 1 ? `${item.qty} × ` : ''}
                        {formatMoney(item.price, currency)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {editable ? (
                  <View style={styles.itemActions}>
                    <Pressable hitSlop={10} onPress={() => startEdit(item)} testID={`item-edit-${item.id}`}>
                      <Ionicons name="create-outline" size={20} color={colors.primary} />
                    </Pressable>
                    <Pressable hitSlop={10} onPress={() => deleteItem({ id: item.id, list_id: id, team_id: teamId })}>
                      <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </Card>
        ))}

        {editable ? (
          <Card>
            <Field label={t('lists.itemName')} value={itemName} onChangeText={setItemName} placeholder={t('lists.itemName')} />
            <View style={styles.inlineFields}>
              <View style={{ flex: 1 }}>
                <Field label={t('lists.qty')} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="1" />
              </View>
              <View style={{ flex: 2 }}>
                <Field label={t('lists.price')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
              </View>
            </View>
            <AppButton title={t('lists.addItem')} onPress={onAddItem} loading={adding} disabled={!itemName.trim()} />
          </Card>
        ) : null}

        {estTotal > 0 ? (
          <View style={styles.estRow}>
            <Text style={styles.estLabel}>{t('lists.estTotal')}</Text>
            <MoneyText amount={estTotal} currency={currency} style={styles.estValue} />
          </View>
        ) : null}

        {editable && checkedCount > 0 && !showCheckout ? (
          <AppButton title={t('lists.checkout')} onPress={openCheckout} style={{ marginTop: spacing(1) }} />
        ) : null}

        {editable && showCheckout ? (
          <Card>
            <SectionTitle>{t('lists.checkoutTitle')}</SectionTitle>
            <Field
              label={t('lists.amount')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              testID="checkout-amount"
              autoFocus
            />
            {touched && !amountValid ? <Muted style={styles.err}>{t('lists.amountPositive')}</Muted> : null}
            <Text style={styles.label}>{t('lists.category')}</Text>
            <View style={styles.row}>
              {(categories ?? []).filter((c) => c.kind === 'expense' || c.kind === 'both').length === 0 ? (
                <Muted>{t('common.none')}</Muted>
              ) : null}
              {(categories ?? [])
                .filter((c) => c.kind === 'expense' || c.kind === 'both')
                .map((c) => (
                  <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
                ))}
            </View>
            <AppButton title={t('lists.confirmCheckout')} onPress={onConfirmCheckout} loading={checkingOut} disabled={!amountValid} />
          </Card>
        ) : null}

        {canEditRow(list) ? (
          <AppButton title={t('lists.deleteList')} variant="danger" onPress={onDelete} loading={deleting} style={{ marginTop: spacing(2) }} />
        ) : null}
      </QueryBoundary>
    </Screen>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    itemMain: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), flex: 1 },
    itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
    itemName: { fontSize: font.md, fontWeight: '600', color: colors.text },
    itemChecked: { textDecorationLine: 'line-through', color: colors.muted },
    itemMeta: { fontSize: font.sm, color: colors.muted, marginTop: spacing(0.25) },
    inlineFields: { flexDirection: 'row', gap: spacing(1.5) },
    estRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing(0.5), marginTop: spacing(1) },
    estLabel: { fontSize: font.md, color: colors.muted, fontWeight: '600' },
    estValue: { fontSize: font.lg, fontWeight: '800', color: colors.text },
    label: { fontSize: font.sm, color: colors.muted, marginBottom: spacing(0.75), fontWeight: '600' },
    row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing(1) },
    err: { color: colors.danger, marginBottom: spacing(1.5) },
    hint: { marginBottom: spacing(1) },
    txLink: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75), marginTop: spacing(1.5) },
    txLinkText: { color: colors.primary, fontSize: font.md, fontWeight: '600' },
  });
