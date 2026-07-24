import { eventMessage, eventHref } from './activity';
import { formatMoney } from './money';

// Derive the currency string the same way eventMessage does, so the assertion is ICU-independent
// ('$12.50' with full ICU vs 'USD 12.50' in the bare Node test env). See money.test.js.
const money = (amount) => formatMoney(amount, 'USD');

const t = (key, vals) => [key, JSON.stringify(vals)].join(' ');
const actor = 'Ana';
const currency = 'USD';

describe('eventMessage — catalog (contract §2)', () => {
  it('transaction created uses the description when present', () => {
    const event = {
      entity: 'transaction',
      action: 'created',
      summary: { type: 'expense', amount: 12.5, description: 'Pizza' },
    };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.transaction_created');
    expect(msg).toContain('"what":"Pizza"');
    expect(msg).toContain(`"amount":"${money(12.5)}"`);
  });

  it('transaction created falls back to the type label when no description', () => {
    const event = { entity: 'transaction', action: 'created', summary: { type: 'expense', amount: 5 } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('transactions.expense');
  });

  it('vault allocated includes the formatted amount', () => {
    const event = { entity: 'vault', action: 'allocated', summary: { name: 'Emergency', amount: 50 } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.vault_allocated');
    expect(msg).toContain(`"amount":"${money(50)}"`);
    expect(msg).toContain('"name":"Emergency"');
  });

  it('shopping list item updated with checked:true uses the _checked key', () => {
    const event = { entity: 'shopping_list_item', action: 'updated', summary: { name: 'Milk', checked: true } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.shopping_list_item_checked');
  });

  it('shopping list item updated with checked:false uses the _updated key', () => {
    const event = { entity: 'shopping_list_item', action: 'updated', summary: { name: 'Milk', checked: false } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.shopping_list_item_updated');
  });

  it('loan created includes the loan name', () => {
    const event = { entity: 'loan', action: 'created', summary: { name: 'Car repair' } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.loan_created');
    expect(msg).toContain('"name":"Car repair"');
  });

  it('loan deleted includes the loan name', () => {
    const event = { entity: 'loan', action: 'deleted', summary: { name: 'Car repair' } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.loan_deleted');
    expect(msg).toContain('"name":"Car repair"');
  });

  it('loan lent includes the formatted amount', () => {
    const event = { entity: 'loan', action: 'lent', summary: { name: 'Car repair', amount: 100 } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.loan_lent');
    expect(msg).toContain(`"amount":"${money(100)}"`);
    expect(msg).toContain('"name":"Car repair"');
  });

  it('loan repaid includes the formatted amount', () => {
    const event = { entity: 'loan', action: 'repaid', summary: { name: 'Car repair', amount: 40 } };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.loan_repaid');
    expect(msg).toContain(`"amount":"${money(40)}"`);
    expect(msg).toContain('"name":"Car repair"');
  });

  it('unknown entity/action falls back to activity.generic', () => {
    const event = { entity: 'widget', action: 'sprocketed', summary: {} };
    const msg = eventMessage(event, { t, actor, currency });
    expect(msg).toContain('activity.generic');
    expect(msg).toContain('"entity":"widget"');
    expect(msg).toContain('"action":"sprocketed"');
  });
});

describe('eventHref — deep links', () => {
  it('maps each entity to its route', () => {
    expect(eventHref({ entity: 'transaction', action: 'updated', entity_id: 7 })).toBe('/(tabs)/transactions/7');
    expect(eventHref({ entity: 'vault', action: 'created', entity_id: 3 })).toBe('/(tabs)/vaults/3');
    expect(eventHref({ entity: 'shopping_list', action: 'checked_out', entity_id: 9 })).toBe(
      '/(tabs)/transactions/lists/9',
    );
    expect(eventHref({ entity: 'team', action: 'updated', entity_id: 1 })).toBe('/(tabs)/teams/1');
    expect(eventHref({ entity: 'loan', action: 'lent', entity_id: 5 })).toBe('/(tabs)/loans/5');
  });

  it('returns null for a deleted event', () => {
    expect(eventHref({ entity: 'transaction', action: 'deleted', entity_id: 7 })).toBeNull();
  });

  it('shopping_list_item uses summary.list_id', () => {
    expect(
      eventHref({ entity: 'shopping_list_item', action: 'created', entity_id: 4, summary: { list_id: 9 } }),
    ).toBe('/(tabs)/transactions/lists/9');
  });

  it('shopping_list_item without a list_id returns null', () => {
    expect(eventHref({ entity: 'shopping_list_item', action: 'created', entity_id: 4, summary: {} })).toBeNull();
  });

  it('returns null for an unknown entity', () => {
    expect(eventHref({ entity: 'widget', action: 'created', entity_id: 1 })).toBeNull();
  });
});
