export interface WebhookEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

export interface WebhookProcessingResult {
  processed: boolean;
  reason?: string;
}
