/**
 * Enforces client isolation and provides content isolation wrappers.
 * Task 4.4, AC8. Extended for multi-client aggregation in 4.3, AC11.
 */
export class ContextBoundary {
  private activeClientId: string | null = null;
  private readonly seenClients: Set<string> = new Set();

  constructor(private readonly primaryClientId: string) {
    if (!primaryClientId) {
      throw new Error('ContextBoundary requires a valid clientId');
    }
  }

  wrapContent(content: string, tagName: string = 'user_content'): string {
    const safeContent = content.replace(new RegExp(`</${tagName}>`, 'g'), `[END_${tagName.toUpperCase()}]`);
    return `<${tagName}>\n${safeContent}\n</${tagName}>`;
  }

  getClientId(): string {
    return this.primaryClientId;
  }

  assertClient(dataClientId: string | null): void {
    if (dataClientId && dataClientId !== this.primaryClientId) {
      throw new Error(`Context boundary violation: expected client ${this.primaryClientId}, got ${dataClientId}`);
    }
  }

  enterClientScope(clientId: string): void {
    if (!clientId) throw new Error('enterClientScope requires a valid clientId');
    this.activeClientId = clientId;
    this.seenClients.add(clientId);
  }

  exitClientScope(): void {
    this.activeClientId = null;
  }

  getActiveClientId(): string | null {
    return this.activeClientId;
  }

  assertInScope(dataClientId: string | null): void {
    if (!this.activeClientId) {
      throw new Error('No active client scope — call enterClientScope first');
    }
    if (dataClientId && dataClientId !== this.activeClientId) {
      throw new Error(`Scope boundary violation: scope is ${this.activeClientId}, got ${dataClientId}`);
    }
  }

  getSeenClients(): ReadonlySet<string> {
    return this.seenClients;
  }
}
