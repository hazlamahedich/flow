export interface PIIToken {
  original: string;
  token: string;
  type: 'email' | 'phone' | 'financial' | 'name';
}

export interface TokenizationResult {
  text: string;
  tokens: PIIToken[];
}

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  financial: /(?:\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s*(?:USD|EUR|GBP|credits)\b)/gi,
  phone: /\b\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};

/**
 * Detects and tokenizes PII in text.
 * Task 3.1
 */
export function tokenizePII(text: string, _workspaceId: string): TokenizationResult {
  let tokenizedText = text;
  const tokens: PIIToken[] = [];
  let tokenCounter = 1;

  // Process patterns
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const original = match[0];
      
      // Skip if already tokenized (simple check)
      if (tokens.some(t => t.original === original)) continue;

      const token = `[${type.toUpperCase()}_${tokenCounter++}]`;
      tokens.push({ original, token, type: type as 'email' | 'phone' | 'financial' });
      
      // Replace all occurrences of this original string with the token
      // Use a regex with global flag to replace all
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      tokenizedText = tokenizedText.replace(new RegExp(escapeRegExp(original), 'g'), token);
    }
  }

  return {
    text: tokenizedText,
    tokens,
  };
}

/**
 * Replaces tokens back with original values.
 */
export function detokenizePII(text: string, tokens: PIIToken[]): string {
  let detokenizedText = text;
  
  // Sort tokens by length descending to avoid partial replacements
  const sortedTokens = [...tokens].sort((a, b) => b.token.length - a.token.length);

  for (const { original, token } of sortedTokens) {
    detokenizedText = detokenizedText.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original);
  }

  return detokenizedText;
}
