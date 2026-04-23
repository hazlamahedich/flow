export interface PIIToken {
  original: string;
  token: string;
}

export function tokenizePII(
  _text: string,
  _workspaceId: string,
): PIIToken[] {
  return [];
}

export function detokenizePII(
  _text: string,
  _tokens: PIIToken[],
): string {
  return _text;
}
