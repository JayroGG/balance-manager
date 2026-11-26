import { AppState } from 'react-native';
import { vaultsApi, applyOrderToCache } from '../../services/api/vaults';
import { balanceApi } from '../../services/api/balance';
import { selectMyUserId } from '../auth';
import { orderSynced, releaseHold, orderKey } from './index';

// How long a synced order keeps winning over a not-yet-agreeing server list (a /balance refetch that
// began before the PUT can still land with the old order).
const HOLD_MS = 60000;

// Background sync of locally saved vault orders. Debounced after the last drop, retried on app
// foreground and after the next successful /balance refetch while pending. Failures stay pending,
// silently. Started once from the store module.
export function startVaultOrderSync(store, { delay = 1500 } = {}) {
  let timer = null;
  let inflight = false;
  let lastSig = '[]';
  let lastBalanceTs = 0;
  const releases = new Map(); // key -> timer; also covers an `awaiting` entry rehydrated from storage

  const pendingEntries = () => {
    const s = store.getState();
    const me = selectMyUserId(s);
    return Object.values(s.vaultOrder?.byKey ?? {}).filter((e) => e.pending && e.userId === me);
  };

  // Vault ids that currently exist for a context (from the cached /balance), or null if not loaded yet.
  const knownIds = (teamId) => {
    const vaults = balanceApi.endpoints.getBalance.select(teamId)(store.getState()).data?.vaults;
    return vaults ? vaults.map((v) => v.id) : null;
  };

  // Sends every pending entry; loops while a drop landed during a PUT. A failed key is not retried
  // within the same pass (it stays pending and waits for the next trigger).
  const flush = async () => {
    if (inflight) return;
    inflight = true;
    const failed = {};
    try {
      for (;;) {
        const todo = pendingEntries().filter((e) => failed[`${e.userId}:${e.teamId}`] !== e.ids.join());
        if (!todo.length) break;
        for (const e of todo) {
          const k = `${e.userId}:${e.teamId}`;
          const known = knownIds(e.teamId);
          if (!known) {
            failed[k] = e.ids.join(); // cannot validate yet — wait for /balance
            continue;
          }
          // Deleted vaults would 400/404 forever: only send ids that still exist.
          const ids = e.ids.filter((id) => known.includes(id));
          try {
            if (ids.length) {
              await store.dispatch(vaultsApi.endpoints.reorderVaults.initiate({ ids, team_id: e.teamId })).unwrap();
              applyOrderToCache(store.dispatch, { ids, team_id: e.teamId });
            }
            store.dispatch(orderSynced({ userId: e.userId, teamId: e.teamId, ids: e.ids}));
          } catch {
            failed[k] = e.ids.join();
          }
        }
      }
    } finally {
      inflight = false;
    }
  };

  const unsubscribe = store.subscribe(() => {
    const s = store.getState();
    const pending = pendingEntries();
    Object.values(s.vaultOrder?.byKey ?? {}).forEach((e) => {
      const k = orderKey(e.userId, e.teamId);
      if (!e.awaiting && releases.has(k)) {
        // The hold ended (new drop / released): drop its timer so a later sync arms a full 60s again.
        clearTimeout(releases.get(k));
        releases.delete(k);
      }
      if (e.awaiting && !releases.has(k)) {
        releases.set(
          k,
          setTimeout(() => {
            releases.delete(k);
            store.dispatch(releaseHold({ userId: e.userId, teamId: e.teamId }));
          }, HOLD_MS),
        );
      }
    });
    const sig = JSON.stringify(pending.map((e) => [e.userId, e.teamId, e.ids]));
    if (sig !== lastSig) {
      lastSig = sig;
      if (pending.length) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          flush();
        }, delay);
      }
    }
    const ts = Math.max(
      0,
      ...Object.values(s.api?.queries ?? {})
        .filter((q) => q?.endpointName === 'getBalance' && q.status === 'fulfilled')
        .map((q) => q.fulfilledTimeStamp ?? 0),
    );
    if (ts > lastBalanceTs) {
      lastBalanceTs = ts;
      if (pending.length && !timer) flush();
    }
  });
  const sub = AppState.addEventListener('change', (st) => {
    if (st === 'active') flush();
  });
  return () => {
    clearTimeout(timer);
    releases.forEach(clearTimeout);
    unsubscribe();
    sub?.remove?.();
  };
}
