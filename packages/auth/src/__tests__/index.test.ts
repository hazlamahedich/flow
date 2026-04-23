import { describe, it, expect } from 'vitest';

describe('@flow/auth package exports', () => {
  it('re-exports trustDevice from device-trust module', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.trustDevice).toBe('function');
  });

  it('re-exports verifyDeviceTrust', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.verifyDeviceTrust).toBe('function');
  });

  it('re-exports hashDeviceToken', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.hashDeviceToken).toBe('function');
  });

  it('re-exports generateDeviceToken', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.generateDeviceToken).toBe('function');
  });

  it('re-exports parseUserAgent', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.parseUserAgent).toBe('function');
  });

  it('re-exports MAX_TRUSTED_DEVICES constant', async () => {
    const mod = await import('@flow/auth');
    expect(mod.MAX_TRUSTED_DEVICES).toBe(5);
  });

  it('re-exports invalidateUserSessions', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.invalidateUserSessions).toBe('function');
  });

  it('re-exports executeOwnershipTransfer', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.executeOwnershipTransfer).toBe('function');
  });

  it('re-exports validateAuthEnv', async () => {
    const mod = await import('@flow/auth');
    expect(typeof mod.validateAuthEnv).toBe('function');
  });
});
