jest.mock('../../utils/config', () => ({ Config: { API_URL: 'http://localhost', AUTH_BYPASS: true } }));

import { Provider } from 'react-redux';
import { renderHook, act } from '@testing-library/react-native';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '../../services/api/baseApi';
import '../../services/api';
import authReducer from '../../reducers/auth';
import contextReducer from '../../reducers/context';
import loanOrderReducer, { mergeLoanOrder } from '../../reducers/loanOrder';
import { useOrderedLoans } from './reorder';

const ids = (l) => l.map((x) => x.id);
const loans = [{ id: 1 }, { id: 2 }, { id: 3 }];

const makeStore = () =>
  configureStore({
    reducer: combineReducers({
      [baseApi.reducerPath]: baseApi.reducer,
      auth: authReducer,
      context: contextReducer,
      loanOrder: loanOrderReducer,
    }),
    preloadedState: { auth: { token: null, user: { id: 7 }, bypass: false, bootstrapped: true } },
    middleware: (g) => g().concat(baseApi.middleware),
    enhancers: (g) => g({ autoBatch: false }),
  });

describe('mergeLoanOrder', () => {
  it('server order without an entry', () => {
    expect(mergeLoanOrder(loans, undefined)).toBe(loans);
  });
  it('saved first, new loans after in server order, deleted dropped', () => {
    expect(ids(mergeLoanOrder([...loans, { id: 4 }], { ids: [3, 99, 1] }))).toEqual([3, 1, 2, 4]);
  });
});

describe('useOrderedLoans', () => {
  it('a drop saves the order on device and survives a refetch with a new loan', () => {
    const store = makeStore();
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
    const { result, rerender } = renderHook(({ l }) => useOrderedLoans(l), { wrapper, initialProps: { l: loans } });
    act(() => result.current.onReorder(['3', '1', '2'], [{ id: 3 }, { id: 1 }, { id: 2 }]));
    expect(ids(result.current.ordered)).toEqual([3, 1, 2]);
    rerender({ l: [...loans, { id: 4 }] });
    expect(ids(result.current.ordered)).toEqual([3, 1, 2, 4]);
    rerender({ l: [{ id: 2 }, { id: 3 }] });
    expect(ids(result.current.ordered)).toEqual([3, 2]);
  });
});
