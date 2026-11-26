import { stripMutations } from './stripMutations';

describe('stripMutations persist transform', () => {
  it('drops api.mutations (login tokens) but keeps the query cache', () => {
    const api = {
      queries: { 'getBalance(null)': { data: { total: 1 } } },
      mutations: { m1: { data: { token: 'secret', refreshToken: 'secret2' } } },
    };
    const out = stripMutations.in(api, 'api', {});
    expect(out.mutations).toEqual({});
    expect(out.queries).toEqual(api.queries);
    expect(JSON.stringify(out)).not.toMatch(/secret/);
  });
});
