import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetItem = vi.fn<(key: string) => string | null>();
const mockSetItem = vi.fn<(key: string, value: string) => void>();
const mockRemoveItem = vi.fn<(key: string) => void>();

vi.stubGlobal('localStorage', {
  getItem: mockGetItem,
  setItem: mockSetItem,
  removeItem: mockRemoveItem,
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

import {
  getOnboardingProgress,
  setOnboardingProgress,
  clearOnboardingProgress,
} from '../../app/(onboarding)/onboarding/_lib/storage';

describe('storage adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOnboardingProgress', () => {
    it('returns stored step', () => {
      mockGetItem.mockReturnValue('agent-demo');
      expect(getOnboardingProgress()).toBe('agent-demo');
      expect(mockGetItem).toHaveBeenCalledWith('flow-onboarding-progress');
    });

    it('returns null when nothing stored', () => {
      mockGetItem.mockReturnValue(null);
      expect(getOnboardingProgress()).toBeNull();
    });

    it('returns null when localStorage throws', () => {
      mockGetItem.mockImplementation(() => {
        throw new Error('not available');
      });
      expect(getOnboardingProgress()).toBeNull();
    });
  });

  describe('setOnboardingProgress', () => {
    it('stores the step', () => {
      setOnboardingProgress('create-client');
      expect(mockSetItem).toHaveBeenCalledWith(
        'flow-onboarding-progress',
        'create-client',
      );
    });

    it('handles QuotaExceededError gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockSetItem.mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      expect(() => setOnboardingProgress('welcome')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'localStorage quota exceeded — onboarding progress not saved',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('clearOnboardingProgress', () => {
    it('removes the stored step', () => {
      clearOnboardingProgress();
      expect(mockRemoveItem).toHaveBeenCalledWith('flow-onboarding-progress');
    });

    it('silently ignores errors', () => {
      mockRemoveItem.mockImplementation(() => {
        throw new Error('not available');
      });
      expect(() => clearOnboardingProgress()).not.toThrow();
    });
  });

  describe('roundtrip', () => {
    it('write then read returns same value', () => {
      mockSetItem.mockImplementation(() => {});
      setOnboardingProgress('log-time');
      mockGetItem.mockReturnValue('log-time');
      expect(getOnboardingProgress()).toBe('log-time');
    });
  });
});
