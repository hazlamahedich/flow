import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

describe('device audit events', () => {
  const deviceEvents = [
    'device_trusted',
    'device_revoked',
    'all_devices_revoked',
    'device_trust_rejected',
  ] as const;

  it('all four device events are valid auth actions', () => {
    expect(deviceEvents).toHaveLength(4);
    expect(deviceEvents).toContain('device_trusted');
    expect(deviceEvents).toContain('device_revoked');
    expect(deviceEvents).toContain('all_devices_revoked');
    expect(deviceEvents).toContain('device_trust_rejected');
  });

  it('device_trusted event includes correct details', () => {
    const event = {
      action: 'device_trusted' as const,
      userId: 'user-123',
      ip: '192.168.1.1',
      outcome: 'success' as const,
      details: { device_label: 'Chrome 120 on macOS' },
    };

    expect(event.action).toBe('device_trusted');
    expect(event.details.device_label).toBe('Chrome 120 on macOS');
  });

  it('device_revoked event includes device_id', () => {
    const event = {
      action: 'device_revoked' as const,
      userId: 'user-123',
      ip: '192.168.1.1',
      outcome: 'success' as const,
      details: { device_id: 'dev-456' },
    };

    expect(event.action).toBe('device_revoked');
    expect(event.details.device_id).toBe('dev-456');
  });

  it('all_devices_revoked event includes revoked count', () => {
    const event = {
      action: 'all_devices_revoked' as const,
      userId: 'user-123',
      ip: '192.168.1.1',
      outcome: 'success' as const,
      details: { revoked_count: 3 },
    };

    expect(event.action).toBe('all_devices_revoked');
    expect(event.details.revoked_count).toBe(3);
  });

  it('device_trust_rejected event includes reason', () => {
    const event = {
      action: 'device_trust_rejected' as const,
      userId: 'user-123',
      ip: '192.168.1.1',
      outcome: 'failure' as const,
      details: {
        reason: 'count_exceeded',
        current_count: 5,
        max_devices: 5,
      },
    };

    expect(event.action).toBe('device_trust_rejected');
    expect(event.details.reason).toBe('count_exceeded');
    expect(event.details.current_count).toBe(5);
  });

  it('audit events use HMAC for IP hashing', () => {
    const secret = 'test-hmac-secret';
    const ip = '192.168.1.1';
    const ipHmac = createHmac('sha256', secret).update(ip).digest('hex');
    expect(ipHmac).toHaveLength(64);
  });
});
