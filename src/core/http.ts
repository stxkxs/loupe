// Per-host request queue for the build/refresh path (Node only — never imported by
// the browser SPA). Enforces a minimum spacing per host, a hard timeout, and a small
// 429-retry, so a full prefetch fan-out stays inside every upstream's rate limit.
//
// openFDA: an optional free server key (OPENFDA_API_KEY) lifts the keyless 1000/day
// shared-IP cap to 120k/day. It is a SERVER env var — never a VITE_ var (those leak
// into client JS).

const SPACING_MS: Record<string, number> = {
  'api.fda.gov': 350, // keyless 240/min ≈ 250ms; 350 is comfortable
  'rxnav.nlm.nih.gov': 120,
  'data.medicaid.gov': 150,
  'data.cms.gov': 150,
  'dailymed.nlm.nih.gov': 150,
}
const TIMEOUT_MS = 20_000
const MAX_RETRY = 2

const chains = new Map<string, Promise<void>>()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function withKey(url: string): string {
  if (new URL(url).host === 'api.fda.gov' && process.env.OPENFDA_API_KEY) {
    return url + (url.includes('?') ? '&' : '?') + `api_key=${process.env.OPENFDA_API_KEY}`
  }
  return url
}

async function schedule<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(host) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  chains.set(
    host,
    prev.then(() => gate),
  )
  await prev
  try {
    return await fn()
  } finally {
    setTimeout(release, SPACING_MS[host] ?? 200)
  }
}

async function fetchOnce(url: string): Promise<Response> {
  return fetch(withKey(url), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', 'user-agent': 'loupe-prefetch (+https://loupe.health)' },
  })
}

/** GET JSON, throwing on non-2xx (after 429 retries). */
export async function getJson<T = unknown>(url: string): Promise<T> {
  const host = new URL(url).host
  return schedule(host, async () => {
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetchOnce(url)
      } catch (err) {
        // network error / timeout — retry with backoff, then give up
        if (attempt < MAX_RETRY) {
          await sleep(1500 * (attempt + 1))
          continue
        }
        throw err
      }
      // retry transient throttling and server errors
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRY) {
        await sleep(1500 * (attempt + 1))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return (await res.json()) as T
    }
  })
}

/** GET JSON, returning null on 404 (openFDA's "no matches" response) — the honest empty state. */
export async function getJsonOrNull<T = unknown>(url: string): Promise<T | null> {
  try {
    return await getJson<T>(url)
  } catch (err) {
    if (err instanceof Error && /HTTP 404/.test(err.message)) return null
    throw err
  }
}
