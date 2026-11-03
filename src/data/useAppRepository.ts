import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseSync } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import migrations from '../../drizzle/migrations';
import { appDeps } from './ids';
import { demoRequested, seedDemoIfEmpty } from './seed';
import { createSqliteRepository } from './sqlite/repository';
import * as schema from './sqlite/schema';
import type { Repository } from './types';

export type AppRepositoryState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; repository: Repository };

const client = openDatabaseSync('evenly.db');
// SQLite leaves foreign keys off per connection unless asked; WAL keeps reads fast during writes.
client.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
const db = drizzle(client, { schema });
const repository = createSqliteRepository(db, appDeps);

/** Native: expo-sqlite, migrated on launch with the same SQL the tests run. */
export function useAppRepository(): AppRepositoryState {
  const migration = useMigrations(db, migrations);
  const [seed, setSeed] = useState<'pending' | 'done' | Error>(demoRequested ? 'pending' : 'done');

  useEffect(() => {
    if (!migration.success || seed !== 'pending') return;
    seedDemoIfEmpty(repository).then(
      () => setSeed('done'),
      (error: unknown) => setSeed(error instanceof Error ? error : new Error(String(error))),
    );
  }, [migration.success, seed]);

  if (migration.error) return { status: 'error', error: migration.error };
  if (seed instanceof Error) return { status: 'error', error: seed };
  if (!migration.success || seed === 'pending') return { status: 'loading' };
  return { status: 'ready', repository };
}
