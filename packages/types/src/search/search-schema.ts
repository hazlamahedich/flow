import { z } from 'zod';

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(200),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

export const SearchResultSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['client', 'invoice', 'time_entry', 'navigation']),
  label: z.string(),
  description: z.string().optional(),
  href: z.string(),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResultsSchema = z.array(SearchResultSchema);

export type SearchResults = z.infer<typeof SearchResultsSchema>;
