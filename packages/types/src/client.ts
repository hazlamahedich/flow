import { z } from 'zod';

export const clientStatusEnum = z.enum(['active', 'archived']);
export type ClientStatus = z.infer<typeof clientStatusEnum>;

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(200),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  companyName: z.string().max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
  billingEmail: z.string().email('Invalid billing email format').optional().or(z.literal('')),
  hourlyRateCents: z.number().int().min(0).max(10000000).nullable().optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable().or(z.literal('')),
  companyName: z.string().max(200).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  notes: z.string().max(5000).optional().nullable().or(z.literal('')),
  billingEmail: z.string().email().optional().nullable().or(z.literal('')),
  hourlyRateCents: z.number().int().min(0).max(10000000).nullable().optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const archiveClientSchema = z.object({
  clientId: z.string().uuid(),
});
export type ArchiveClientInput = z.infer<typeof archiveClientSchema>;

export const clientListFiltersSchema = z.object({
  status: clientStatusEnum.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
  sortBy: z.enum(['name', 'created_at']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
export type ClientListFilters = z.infer<typeof clientListFiltersSchema>;

export const clientSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  billingEmail: z.string().nullable(),
  hourlyRateCents: z.number().nullable(),
  status: clientStatusEnum,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Client = z.infer<typeof clientSchema>;
