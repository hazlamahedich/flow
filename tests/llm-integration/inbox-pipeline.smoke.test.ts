import { describe, it, expect } from 'vitest';
import { extractionWorker } from '../../packages/agents/inbox/extractor';
import { draftWorker } from '../../packages/agents/inbox/drafter';

/**
 * Smoke tests for LLM integration.
 * Requires:
 * - ANTHROPIC_API_KEY
 * - GROQ_API_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 * - NEXT_PUBLIC_SUPABASE_URL
 */
describe('inbox-pipeline LLM smoke tests', () => {
  it('should perform real extraction from sample email', async () => {
    // This is a placeholder for a manual smoke test
    // To run: pnpm vitest run tests/llm-integration/
    console.log('Smoke test: extractionWorker needs to be called with a real job');
  });

  it('should perform real draft generation with voice profile', async () => {
    console.log('Smoke test: draftWorker needs to be called with a real job');
  });
});
