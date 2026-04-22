import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProfileSchema, uploadAvatarSchema, requestEmailChangeSchema } from '@flow/types';

describe('updateProfileSchema', () => {
  it('accepts valid name and timezone', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Jane Doe',
      timezone: 'America/New_York',
    });
    expect(result.success).toBe(true);
  });

  it('accepts name with Unicode characters', () => {
    const result = updateProfileSchema.safeParse({
      name: '田中太郎',
      timezone: 'Asia/Tokyo',
    });
    expect(result.success).toBe(true);
  });

  it('accepts 100-character name', () => {
    const result = updateProfileSchema.safeParse({
      name: 'a'.repeat(100),
      timezone: 'UTC',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = updateProfileSchema.safeParse({
      name: '',
      timezone: 'UTC',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('1 and 100');
    }
  });

  it('rejects 101-character name', () => {
    const result = updateProfileSchema.safeParse({
      name: 'a'.repeat(101),
      timezone: 'UTC',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('1 and 100');
    }
  });

  it('rejects invalid timezone', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Test',
      timezone: 'Invalid/Timezone',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('timezone');
    }
  });
});

describe('uploadAvatarSchema', () => {
  it('accepts valid JPEG under 2MB', () => {
    const result = uploadAvatarSchema.safeParse({
      contentType: 'image/jpeg',
      fileSize: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid PNG under 2MB', () => {
    const result = uploadAvatarSchema.safeParse({
      contentType: 'image/png',
      fileSize: 2 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid WebP under 2MB', () => {
    const result = uploadAvatarSchema.safeParse({
      contentType: 'image/webp',
      fileSize: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects file over 2MB', () => {
    const result = uploadAvatarSchema.safeParse({
      contentType: 'image/jpeg',
      fileSize: 2 * 1024 * 1024 + 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('2MB');
    }
  });

  it('rejects wrong MIME type', () => {
    const result = uploadAvatarSchema.safeParse({
      contentType: 'image/svg+xml',
      fileSize: 1024,
    });
    expect(result.success).toBe(false);
  });
});

describe('requestEmailChangeSchema', () => {
  it('accepts valid email', () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: 'user@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('valid email');
    }
  });

  it('rejects empty email', () => {
    const result = requestEmailChangeSchema.safeParse({
      newEmail: '',
    });
    expect(result.success).toBe(false);
  });
});
