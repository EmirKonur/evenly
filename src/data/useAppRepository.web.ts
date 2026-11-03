import { useEffect, useState } from 'react';

import { appDeps } from './ids';
import { createMemoryRepository, type MemorySnapshot } from './memory/repository';
import { demoRequested, seedDemoIfEmpty } from './seed';
import type { AppRepositoryState } from './useAppRepository';

const STORAGE_KEY = 'evenly:snapshot:v1';

function restore(): MemorySnapshot | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<MemorySnapshot>) : null;
    return parsed?.version === 1 ? (parsed as MemorySnapshot) : undefined;
  } catch {
    return undefined;
  }
}

function persist(snapshot: MemorySnapshot) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Private windows and full quotas refuse writes; the session still works in memory.
  }
}

/**
 * Web: the in-memory repository, snapshotted to localStorage after every write. Same UI,
 * same contract, no cross-origin isolation headers needed for SQLite's WASM build.
 */
export function useAppRepository(): AppRepositoryState {
  const [state, setState] = useState<AppRepositoryState>({ status: 'loading' });

  useEffect(() => {
    const repository = createMemoryRepository(appDeps, restore());
    const unsubscribe = repository.subscribe(() => persist(repository.snapshot()));
    (demoRequested ? seedDemoIfEmpty(repository) : Promise.resolve()).then(
      () => setState({ status: 'ready', repository }),
      (error: unknown) =>
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return unsubscribe;
  }, []);

  return state;
}
