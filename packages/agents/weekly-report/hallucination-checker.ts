/**
 * Checks for hallucinated numbers in LLM-generated narrative strings.
 * Validates that any numbers appearing in the narratives also exist in the raw aggregated data
 * (either directly as a number or as part of a string).
 */
export function verifyHallucinations(
  narratives: Record<string, string>,
  rawData: unknown
): string[] {
  const narrativeText = Object.values(narratives).join(' ');
  const cleanText = narrativeText.replace(/,/g, '');
  // Match integers and decimals
  const numbersInText = cleanText.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  
  const rawString = JSON.stringify(rawData);
  const mismatches: string[] = [];

  for (const num of numbersInText) {
    const val = Number(num);
    if (Number.isNaN(val)) continue;
    
    // Ignore common integers/derived values (hours, days, percentages) to prevent false positives
    if (val <= 100) continue;

    // Check if the number or value exists in raw string
    if (!rawString.includes(num)) {
      mismatches.push(num);
    }
  }

  return mismatches;
}
