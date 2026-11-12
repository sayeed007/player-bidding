import { redirect } from 'next/navigation';
import { me } from '@/lib/server';
import { isStaff } from '@/lib/roles';
import Landing from './landing';

export const dynamic = 'force-dynamic';

// Staff never see the public landing page: `/` always sends them to the admin area (server-side, so no flash).
export default async function Page() {
  const u = await me().catch(() => null);
  if (isStaff(u)) redirect('/admin');
  return <Landing />;
}
