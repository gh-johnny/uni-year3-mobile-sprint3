import { Redirect } from 'expo-router';

import { useSession } from '@/presentation/state/session-store';

/** Entry point: routes each persona to its home. */
export default function Index() {
  const { status, user, locked } = useSession();
  if (status !== 'signedIn' || locked) return <Redirect href="/sign-in" />;
  return <Redirect href={user?.role.key === 'advisor' ? '/pulse' : '/garage'} />;
}
