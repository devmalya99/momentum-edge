export const NSE_BROWSER_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.nseindia.com/',
  Origin: 'https://www.nseindia.com',
};

export type NseJsonOk<T> = { ok: true; data: T };
export type NseJsonErr = { ok: false; status: number; detail: string };
export type NseJsonResult<T> = NseJsonOk<T> | NseJsonErr;

export async function nseFetchJson<T = unknown>(url: string): Promise<NseJsonResult<T>> {
  const response = await fetch(url, {
    headers: NSE_BROWSER_HEADERS,
    cache: 'no-store',
  });
  const raw = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    return { ok: false, status: response.status, detail: raw.slice(0, 300) };
  }

  if (!contentType.includes('application/json')) {
    return { ok: false, status: 502, detail: raw.slice(0, 300) };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, status: 502, detail: raw.slice(0, 200) };
  }
}
