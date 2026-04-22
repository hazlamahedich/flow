import { z } from 'zod';

const IANA_TIMEZONES: readonly string[] =
  typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : [];

const EXTRA_VALID_TIMEZONES = new Set(['UTC']);

function isValidTimezone(tz: string): boolean {
  if (EXTRA_VALID_TIMEZONES.has(tz)) return true;
  if (IANA_TIMEZONES.length === 0) {
    return tz.length > 0;
  }
  return IANA_TIMEZONES.includes(tz);
}

export function getTimezones(): readonly string[] {
  return IANA_TIMEZONES;
}

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Display name must be between 1 and 100 characters.')
    .max(100, 'Display name must be between 1 and 100 characters.'),
  timezone: z
    .string()
    .min(1, 'Please select a valid timezone.')
    .refine(
      (tz) => isValidTimezone(tz),
      { message: 'Please select a valid timezone.' },
    ),
});

export const uploadAvatarSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    message: 'Avatar must be a JPEG, PNG, or WebP image.',
  }),
  fileSize: z
    .number()
    .max(2 * 1024 * 1024, 'Avatar must be smaller than 2MB.'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;

export const requestEmailChangeSchema = z.object({
  newEmail: z.string().email('Please enter a valid email address.'),
});

export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;

export interface PendingEmailChange {
  pending: boolean;
  newEmail: string | null;
  expiresAt: string | null;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  timezone: string;
  avatarUrl: string | null;
  updatedAt: string;
}
