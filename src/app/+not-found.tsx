import { router } from 'expo-router';

import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { LostIllustration } from '@/ui/illustrations';
import { Screen } from '@/ui/Screen';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        illustration={<LostIllustration size={240} />}
        title="This receipt blew away"
        body="There is nothing at this address. Your groups are safe on the main screen."
        action={<Button label="Back to your groups" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
