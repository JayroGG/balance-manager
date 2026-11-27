import { orderKey, applySavedOrder } from './savedOrder';

describe('savedOrder', () => {
  it('orderKey: per user + context', () => {
    expect(orderKey(7, null)).toBe('7:personal');
    expect(orderKey(7, 3)).toBe('7:3');
    expect(orderKey(undefined, null)).toBe('anon:personal');
  });
  it('applySavedOrder: saved first, rest in list order, unknown ids dropped', () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(applySavedOrder(list, [3, 99, 1]).map((x) => x.id)).toEqual([3, 1, 2, 4]);
  });
});
