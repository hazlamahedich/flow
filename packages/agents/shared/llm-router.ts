export interface LLMRouter {
  categorize: (input: unknown) => Promise<unknown>;
  extract: (input: unknown) => Promise<unknown>;
  draft: (input: unknown) => Promise<unknown>;
  report: (input: unknown) => Promise<unknown>;
}

export function createLLMRouter(): LLMRouter {
  return {
    categorize: async (_input: unknown) => ({}),
    extract: async (_input: unknown) => ({}),
    draft: async (_input: unknown) => ({}),
    report: async (_input: unknown) => ({}),
  };
}
