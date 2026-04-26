interface ClientOverrides {
  id?: string;
  workspaceId?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
  notes?: string | null;
  billingEmail?: string | null;
  hourlyRateCents?: number | null;
  status?: 'active' | 'archived';
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function buildClient(overrides: ClientOverrides = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Client ${id.slice(0, 8)}`,
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    companyName: overrides.companyName ?? null,
    address: overrides.address ?? null,
    notes: overrides.notes ?? null,
    billingEmail: overrides.billingEmail ?? null,
    hourlyRateCents: overrides.hourlyRateCents ?? null,
    status: overrides.status ?? 'active',
    archivedAt: overrides.archivedAt ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

interface ClientAccessOverrides {
  id?: string;
  workspaceId?: string;
  userId?: string;
  clientId?: string;
  grantedBy?: string;
  grantedAt?: string | null;
  revokedAt?: string | null;
}

export function buildClientAccess(overrides: ClientAccessOverrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
    userId: overrides.userId ?? crypto.randomUUID(),
    clientId: overrides.clientId ?? crypto.randomUUID(),
    grantedBy: overrides.grantedBy ?? crypto.randomUUID(),
    grantedAt: overrides.grantedAt ?? new Date().toISOString(),
    revokedAt: overrides.revokedAt ?? null,
  };
}
