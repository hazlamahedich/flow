import { createHash } from 'crypto';
import { redirect } from 'next/navigation';
import { createServerClient } from '@flow/db';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { acceptInvitation } from './actions/accept-invitation';

async function handleAccept(formData: FormData) {
  'use server';
  const result = await acceptInvitation(formData);
  if (result.success) {
    redirect('/');
  }
  redirect(`/invite/${formData.get('token')}?error=${encodeURIComponent(
    'error' in result && result.error ? (result.error as { message: string }).message : 'Failed to accept invitation'
  )}`);
}

async function getInvitationStatus(token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const cookieStore = await cookies();
  const supabase = createServerClient({
    getAll() {
      return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    set() {},
  });

  const { data: { session } } = await supabase.auth.getSession();

  const { data: invitation } = await supabase
    .from('workspace_invitations')
    .select('id, workspace_id, email, role, expires_at, accepted_at, workspaces(name)')
    .eq('token_hash', tokenHash)
    .single();

  if (!invitation) {
    return { status: 'not_found' as const };
  }

  if (invitation.accepted_at) {
    return {
      status: 'already_accepted' as const,
      workspaceName: (invitation.workspaces as unknown as { name: string })?.name ?? 'the workspace',
    };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { status: 'expired' as const };
  }

  if (!session) {
    return {
      status: 'new_user' as const,
      token,
      email: invitation.email,
    };
  }

  return {
    status: 'existing_user' as const,
    token,
    email: invitation.email,
    role: invitation.role,
    workspaceName: (invitation.workspaces as unknown as { name: string })?.name ?? 'the workspace',
    workspaceId: invitation.workspace_id,
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationStatus(token);

  if (invitation.status === 'new_user') {
    redirect(`/login?invite=${token}&email=${encodeURIComponent(invitation.email)}`);
  }

  if (invitation.status === 'not_found') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
            Invitation Not Found
          </h1>
          <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
            This invitation link is invalid. Please contact your workspace owner for a new invitation.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-[var(--flow-color-text-accent)] underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
            Invitation Expired
          </h1>
          <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
            This invitation has expired. Contact your workspace owner for a new one.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm text-[var(--flow-color-text-accent)] underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === 'already_accepted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
            Already a Member
          </h1>
          <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
            {`You're already a member of ${invitation.workspaceName}.`}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-[var(--flow-color-text-accent)] underline"
          >
            Go to workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
          {`Join ${invitation.workspaceName}`}
        </h1>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          {`You've been invited to join as ${invitation.role}.`}
        </p>
        <form action={handleAccept} className="mt-6">
          <input type="hidden" name="token" value={invitation.token} />
          <button
            type="submit"
            className="rounded-md bg-[var(--flow-color-bg-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Accept Invitation
          </button>
        </form>
      </div>
    </div>
  );
}
