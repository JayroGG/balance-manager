import { formatMoney } from './money';

// Event catalog → i18n message (contract §2). Unknown entity/action MUST fall back to the generic
// line so future event types never crash the feed. Amounts in `summary` are decimals, as everywhere.
export const eventMessage = (event, { t, actor, currency }) => {
  const { entity, action, summary = {} } = event;
  const amount = summary.amount != null ? formatMoney(summary.amount, currency) : undefined;
  const key = `${entity}_${action}`;
  switch (key) {
    case 'transaction_created':
    case 'transaction_updated':
    case 'transaction_deleted':
      return t(`activity.${key}`, {
        actor, amount,
        what: summary.description || t(`transactions.${summary.type}`, { defaultValue: summary.type }),
      });
    case 'vault_created':
    case 'vault_deleted':
    case 'shopping_list_created':
    case 'shopping_list_deleted':
      return t(`activity.${key}`, { actor, name: summary.name });
    case 'vault_allocated':
    case 'vault_withdrawn':
    case 'shopping_list_checked_out':
      return t(`activity.${key}`, { actor, name: summary.name, amount });
    case 'shopping_list_item_created':
    case 'shopping_list_item_deleted':
      return t(`activity.${key}`, { actor, name: summary.name });
    case 'shopping_list_item_updated':
      return summary.checked
        ? t('activity.shopping_list_item_checked', { actor, name: summary.name })
        : t('activity.shopping_list_item_updated', { actor, name: summary.name });
    case 'team_updated':
      return summary.name
        ? t('activity.team_renamed', { actor, name: summary.name })
        : t('activity.team_updated', { actor });
    case 'team_member_added':
    case 'team_role_changed':
      return t(`activity.${key}`, {
        actor, role: t(`teams.role_${summary.role}`, { defaultValue: summary.role }),
      });
    case 'team_member_removed':
      return t('activity.team_member_removed', { actor });
    case 'loan_created':
    case 'loan_deleted':
      return t(`activity.${key}`, { actor, name: summary.name });
    case 'loan_lent':
    case 'loan_repaid':
      return t(`activity.${key}`, { actor, name: summary.name, amount });
    default:
      return t('activity.generic', { actor, entity, action });
  }
};

// Deep link to the affected record (contract: entity_id). Deleted/unknown → null (no navigation);
// a 404 on an edited-away record is handled by the target screen, as usual.
export const eventHref = ({ entity, action, entity_id, summary = {} }) => {
  if (action === 'deleted') return null;
  switch (entity) {
    case 'transaction': return `/(tabs)/transactions/${entity_id}`;
    case 'vault': return `/(tabs)/vaults/${entity_id}`;
    case 'shopping_list': return `/(tabs)/transactions/lists/${entity_id}`;
    case 'shopping_list_item':
      return summary.list_id ? `/(tabs)/transactions/lists/${summary.list_id}` : null;
    case 'team': return `/(tabs)/teams/${entity_id}`;
    case 'loan': return `/(tabs)/loans/${entity_id}`;
    default: return null;
  }
};
