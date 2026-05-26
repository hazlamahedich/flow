export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  metadata: Record<string, string>;
}

export interface TransactionalEmailResult {
  messageId: string;
}

export interface TransactionalEmailProvider {
  getProviderName(): string;
  send(payload: TransactionalEmailPayload): Promise<TransactionalEmailResult>;
}
