import { getUserDevices } from '@flow/auth/device-trust';
import type { ClientDeviceRecord } from '@flow/auth/device-types';
import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { DevicesList } from './components/devices-list';

export default async function DevicesPage() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const devices = await getUserDevices(session.user.id, supabase);

  const clientDevices: ClientDeviceRecord[] = devices.map((d) => ({
    id: d.id,
    label: d.label,
    userAgentHint: d.userAgentHint,
    lastSeenAt: d.lastSeenAt,
    createdAt: d.createdAt,
    isRevoked: d.isRevoked,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--flow-color-text-primary)]">
          Your Devices
        </h1>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          Manage devices trusted to stay signed in. You can have up to 5 trusted devices.
        </p>
      </div>

      <DevicesList devices={clientDevices} />
    </div>
  );
}
