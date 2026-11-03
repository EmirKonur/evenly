import { randomUUID } from 'expo-crypto';

import type { RepositoryDeps } from './types';

/** Production id and clock sources. Tests inject deterministic ones instead. */
export const appDeps: RepositoryDeps = {
  newId: () => randomUUID(),
  now: () => Date.now(),
};
