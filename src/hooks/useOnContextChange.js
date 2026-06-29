import { useEffect, useRef } from 'react';
import { useNavigation } from 'expo-router';
import { useActiveTeamId } from './useActiveTeamId';

// Fires `onChange` whenever the active team context flips (personal↔team or team↔team). Context-scoped
// UI that's still mounted — a pushed detail/create screen, an open inline editor — targets an id from the
// context it opened in; once the context switches that target is stale and the next refetch or Save
// 403/404s. Callers use this to dismiss or reset before that happens. (fixes stale-context edits)
export const useOnContextChange = (onChange) => {
  const teamId = useActiveTeamId();
  const prev = useRef(teamId);
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (teamId !== prev.current) {
      prev.current = teamId;
      cb.current();
    }
  }, [teamId]);
};

// Convenience for pushed stack screens (vault/transaction detail + create): pop back to the list root on
// a context change so the stale id-scoped screen can't refetch the wrong context. Fires even on a
// background tab, since expo-router keeps tab stacks mounted.
export const useDismissOnContextChange = () => {
  const navigation = useNavigation();
  useOnContextChange(() => navigation.popToTop());
};
