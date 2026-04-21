export interface DeviceRecord {
  id: string;
  userId: string;
  deviceTokenHash: string;
  label: string;
  userAgentHint: string | null;
  lastSeenAt: string;
  createdAt: string;
  isRevoked: boolean;
}

export interface ClientDeviceRecord {
  id: string;
  label: string;
  userAgentHint: string | null;
  lastSeenAt: string;
  createdAt: string;
  isRevoked: boolean;
}

export interface TrustDeviceResult {
  trusted: true;
  deviceToken: string;
  deviceId: string;
}

export interface TrustDeviceRejected {
  trusted: false;
  reason: 'count_exceeded';
  currentCount: number;
  maxDevices: number;
}

export interface RevokeDeviceResult {
  revoked: true;
  deviceId: string;
}

export const MAX_TRUSTED_DEVICES = 5;
export const DEVICE_COOKIE_NAME = 'flow_device';
export const DEVICE_PENDING_COOKIE_NAME = 'flow_device_pending';
export const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const DEVICE_PENDING_COOKIE_MAX_AGE = 10 * 60;
