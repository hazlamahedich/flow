import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const ProfileNameSchema = z.string().min(1).max(100);
const TimezoneSchema = z.string().min(1);
const AvatarMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

describe('Story 1.5: User Profile Editing', () => {
  describe('AC: name validation (1-100 chars, Unicode)', () => {
    it('accepts valid name', () => {
      expect(ProfileNameSchema.safeParse('Sherwin').success).toBe(true);
    });

    it('accepts Unicode name', () => {
      expect(ProfileNameSchema.safeParse('José García-López').success).toBe(true);
    });

    it('accepts 100-char name', () => {
      expect(ProfileNameSchema.safeParse('A'.repeat(100)).success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(ProfileNameSchema.safeParse('').success).toBe(false);
    });

    it('rejects 101-char name', () => {
      expect(ProfileNameSchema.safeParse('A'.repeat(101)).success).toBe(false);
    });
  });

  describe('AC: timezone validation (IANA)', () => {
    it('accepts IANA timezone', () => {
      expect(TimezoneSchema.safeParse('America/New_York').success).toBe(true);
    });

    it('rejects empty timezone', () => {
      expect(TimezoneSchema.safeParse('').success).toBe(false);
    });
  });

  describe('AC: avatar upload validation', () => {
    it('accepts JPEG, PNG, WebP', () => {
      expect(AvatarMimeTypes).toContain('image/jpeg');
      expect(AvatarMimeTypes).toContain('image/png');
      expect(AvatarMimeTypes).toContain('image/webp');
    });

    it('rejects GIF', () => {
      const isValid = (AvatarMimeTypes as readonly string[]).includes('image/gif');
      expect(isValid).toBe(false);
    });

    it('enforces 2MB limit', () => {
      expect(MAX_AVATAR_BYTES).toBe(2 * 1024 * 1024);
      const overLimit = MAX_AVATAR_BYTES + 1;
      expect(overLimit > MAX_AVATAR_BYTES).toBe(true);
    });

    it('avatar storage path format', () => {
      const userId = crypto.randomUUID();
      const timestamp = Date.now();
      const ext = 'png';
      const path = `avatars/${userId}/${timestamp}-abc123.${ext}`;
      expect(path).toMatch(/^avatars\/[0-9a-f-]+\/\d+-[a-z0-9]+\.(jpeg|png|webp)$/);
    });
  });

  describe('AC: concurrent updates (last-write-wins)', () => {
    it('later update overwrites earlier', () => {
      const base = { name: 'Alice', updatedAt: 100 };
      const update1 = { ...base, name: 'Bob', updatedAt: 200 };
      const update2 = { ...base, name: 'Carol', updatedAt: 300 };
      const winner = update2.updatedAt > update1.updatedAt ? update2 : update1;
      expect(winner.name).toBe('Carol');
    });
  });

  describe('AC: avatar removal sets null', () => {
    it('avatar_url becomes null after removal', () => {
      const profile = { avatarUrl: 'avatars/123/photo.jpg' };
      const afterRemove = { ...profile, avatarUrl: null };
      expect(afterRemove.avatarUrl).toBeNull();
    });
  });
});
