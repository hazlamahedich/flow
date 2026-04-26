import { z } from 'zod';

export const IssueCorrectionSchema = z.object({
  originalRunId: z.string().uuid(),
  correctedOutput: z.record(z.unknown()),
});
