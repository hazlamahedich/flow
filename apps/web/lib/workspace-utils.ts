import { randomBytes } from 'crypto';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

export function generateSlug(name: string): string {
  const base = slugify(name);
  const hash = randomBytes(3).toString('hex');
  return `${base}-${hash}`;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
}

export function mapWorkspaceRow(row: WorkspaceRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: row.settings,
  };
}
