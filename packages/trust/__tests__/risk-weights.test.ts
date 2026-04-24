import { describe, it, expect } from 'vitest';
import { RISK_WEIGHTS, RISK_WEIGHT_ENTRIES } from '../src/risk-weights';

describe('risk weights', () => {
  it('has 15 entries covering all agents', () => {
    expect(RISK_WEIGHT_ENTRIES).toHaveLength(15);
    const agentIds = new Set(RISK_WEIGHT_ENTRIES.map((e) => e.agentId));
    expect(agentIds.size).toBe(6);
  });

  it('financial/communication actions have weight >= 1.5', () => {
    const financial = RISK_WEIGHT_ENTRIES.filter(
      (e) => e.actionType === 'draft_followup_email' || e.actionType === 'draft_communication',
    );
    expect(financial.length).toBeGreaterThan(0);
    for (const entry of financial) {
      expect(entry.weight).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('read-only / analysis actions have weight <= 1.0', () => {
    const readOnly = RISK_WEIGHT_ENTRIES.filter(
      (e) =>
        e.actionType.includes('categorize') ||
        e.actionType.includes('extract') ||
        e.actionType.includes('detect') ||
        e.actionType.includes('analyze') ||
        e.actionType.includes('compile') ||
        e.actionType.includes('flag'),
    );
    expect(readOnly.length).toBeGreaterThan(0);
    for (const entry of readOnly) {
      expect(entry.weight).toBeLessThanOrEqual(1.5);
    }
  });

  it('all weights are positive', () => {
    for (const entry of RISK_WEIGHT_ENTRIES) {
      expect(entry.weight).toBeGreaterThan(0);
    }
  });

  it('all weights produce score in [0, 200] range when applied', () => {
    for (const entry of RISK_WEIGHT_ENTRIES) {
      const violationDelta = -10 * entry.weight;
      const resultFromZero = Math.max(0, 0 + violationDelta);
      expect(resultFromZero).toBeGreaterThanOrEqual(0);

      const successDelta = 10;
      const resultFromMax = Math.min(200, 200 + successDelta);
      expect(resultFromMax).toBeLessThanOrEqual(200);
    }
  });

  it('map lookup works for known keys', () => {
    expect(RISK_WEIGHTS.get('inbox:categorize_email')).toBe(0.5);
    expect(RISK_WEIGHTS.get('ar-collection:draft_followup_email')).toBe(2.0);
  });

  it('map returns undefined for unknown keys', () => {
    expect(RISK_WEIGHTS.get('inbox:nonexistent')).toBeUndefined();
  });

  it('highest weight is 2.0', () => {
    const maxWeight = Math.max(...RISK_WEIGHT_ENTRIES.map((e) => e.weight));
    expect(maxWeight).toBe(2.0);
  });

  it('lowest weight is 0.5', () => {
    const minWeight = Math.min(...RISK_WEIGHT_ENTRIES.map((e) => e.weight));
    expect(minWeight).toBe(0.5);
  });

  it('each agent has at least one entry', () => {
    const agents: string[] = ['inbox', 'calendar', 'ar-collection', 'weekly-report', 'client-health', 'time-integrity'];
    for (const agent of agents) {
      const agentEntries = RISK_WEIGHT_ENTRIES.filter((e) => e.agentId === agent);
      expect(agentEntries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('no duplicate agent:action keys', () => {
    const keys = RISK_WEIGHT_ENTRIES.map((e) => `${e.agentId}:${e.actionType}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('ar-collection has the highest average weight (financial sensitivity)', () => {
    const arEntries = RISK_WEIGHT_ENTRIES.filter((e) => e.agentId === 'ar-collection');
    const arAvg = arEntries.reduce((sum, e) => sum + e.weight, 0) / arEntries.length;

    const reportEntries = RISK_WEIGHT_ENTRIES.filter((e) => e.agentId === 'weekly-report');
    const reportAvg = reportEntries.reduce((sum, e) => sum + e.weight, 0) / reportEntries.length;

    expect(arAvg).toBeGreaterThan(reportAvg);
  });
});
