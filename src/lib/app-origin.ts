const DEFAULT_DEV_ORIGIN = 'http://localhost:3000';

export function getAppOrigin(): string {
  const rawAppUrl = process.env.APP_URL?.trim();
  if (!rawAppUrl) return DEFAULT_DEV_ORIGIN;

  try {
    const parsed = new URL(rawAppUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    return DEFAULT_DEV_ORIGIN;
  }

  return DEFAULT_DEV_ORIGIN;
}

export function buildAppUrl(pathnameWithQuery: string): URL {
  return new URL(pathnameWithQuery, getAppOrigin());
}
