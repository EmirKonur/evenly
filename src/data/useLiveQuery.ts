import { useEffect, useEffectEvent, useState } from 'react';

import { useRepository } from './RepositoryContext';
import type { GroupLedger, Person, Repository } from './types';

export type QueryState<T> =
  { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: T };

/**
 * Runs a read against the repository and re-runs it after every write. Screens keep showing
 * the previous result while a refresh is in flight, so a save never flashes a spinner.
 */
export function useLiveQuery<T>(
  load: (repository: Repository) => Promise<T>,
  key: string,
): QueryState<T> {
  const repository = useRepository();
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const run = useEffectEvent(() => load(repository));

  useEffect(() => {
    let active = true;
    const refresh = () => {
      run().then(
        (data) => active && setState({ status: 'ready', data }),
        (error: unknown) =>
          active &&
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          }),
      );
    };
    refresh();
    const unsubscribe = repository.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository, key]);

  return state;
}

export function useSelf(): QueryState<Person | null> {
  return useLiveQuery((repository) => repository.getSelf(), 'self');
}

export function useGroups(): QueryState<GroupLedger[]> {
  return useLiveQuery((repository) => repository.listGroups(), 'groups');
}

export function useGroupLedger(groupId: string): QueryState<GroupLedger | null> {
  return useLiveQuery((repository) => repository.getGroup(groupId), `group:${groupId}`);
}
