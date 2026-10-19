/** Placeholder hosts are never rendered as links or exported as sources. */
const PLACEHOLDER = /(^|\.)(example\.(com|org|net)|example|invalid|test|localhost)$/i;

export function realSourceUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    if (PLACEHOLDER.test(parsed.hostname)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export const NO_SOURCE_TEXT = "Fictional seed signal, no source link";
