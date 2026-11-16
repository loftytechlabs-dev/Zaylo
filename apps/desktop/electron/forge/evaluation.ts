export function scoreResponse(expected: string, actual: string): { exactMatch: number; tokenF1: number } {
  const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
  const expectedText = normalize(expected);
  const actualText = normalize(actual);
  const expectedTokens = expectedText ? expectedText.split(' ') : [];
  const actualTokens = actualText ? actualText.split(' ') : [];
  const remaining = new Map<string, number>();
  for (const token of expectedTokens) remaining.set(token, (remaining.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of actualTokens) {
    const count = remaining.get(token) ?? 0;
    if (count > 0) {
      overlap++;
      remaining.set(token, count - 1);
    }
  }
  return {
    exactMatch: Number(expectedText === actualText),
    tokenF1: expectedTokens.length + actualTokens.length === 0 ? 1 : 2 * overlap / (expectedTokens.length + actualTokens.length),
  };
}
