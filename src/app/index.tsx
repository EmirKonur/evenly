import { Redirect } from 'expo-router';

import { useSelf } from '@/data/useLiveQuery';

/** Sends first-time users to onboarding and everyone else to their groups. */
export default function Index() {
  const self = useSelf();
  if (self.status === 'loading') return null;
  if (self.status === 'ready' && self.data) return <Redirect href="/groups" />;
  return <Redirect href="/onboarding" />;
}
