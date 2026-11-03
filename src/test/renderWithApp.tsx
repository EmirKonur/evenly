import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createMemoryRepository } from '@/data/memory/repository';
import { RepositoryContext } from '@/data/RepositoryContext';
import type { Repository } from '@/data/types';
import { ToastProvider } from '@/ui/Toast';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function testRepository() {
  let id = 0;
  let clock = Date.UTC(2026, 9, 12, 12);
  return createMemoryRepository({ newId: () => `id-${++id}`, now: () => (clock += 1000) });
}

/** Renders a screen-level component with the same providers the app root sets up. */
export function renderWithApp(ui: ReactElement, repository: Repository = testRepository()) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <RepositoryContext.Provider value={repository}>
        <ToastProvider>{ui}</ToastProvider>
      </RepositoryContext.Provider>
    </SafeAreaProvider>,
  );
}
