import { describe, test, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
} from '../../../app/(workspace)/time/utils/time-conversion';

describe('timeToMinutes', () => {
  test('converts midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  test('converts end of day', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  test('converts noon', () => {
    expect(timeToMinutes('12:00')).toBe(720);
  });

  test('converts 09:00', () => {
    expect(timeToMinutes('09:00')).toBe(540);
  });

  test('converts 17:00', () => {
    expect(timeToMinutes('17:00')).toBe(1020);
  });

  test('converts single-digit hour', () => {
    expect(timeToMinutes('01:30')).toBe(90);
  });
});

describe('minutesToTime', () => {
  test('converts midnight', () => {
    expect(minutesToTime(0)).toBe('00:00');
  });

  test('converts end of day', () => {
    expect(minutesToTime(1439)).toBe('23:59');
  });

  test('converts noon', () => {
    expect(minutesToTime(720)).toBe('12:00');
  });

  test('zero-pads hours and minutes', () => {
    expect(minutesToTime(90)).toBe('01:30');
  });
});

describe('roundtrip', () => {
  test('timeToMinutes(minutesToTime(n)) === n for all hours', () => {
    for (let n = 0; n <= 1439; n += 60) {
      expect(timeToMinutes(minutesToTime(n))).toBe(n);
    }
  });
});
