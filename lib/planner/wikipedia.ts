import type { DestinationInfo } from "../types";

/**
 * Destination photo + intro from Wikipedia's free REST API. Results are cached in memory per
 * destination: Wikipedia rate-limits bursts, and the same places get searched over and over.
 */

const HEADERS = { "User-Agent": "BongoPrompt/0.1 (Bangladesh travel planner)", Accept: "application/json" };

export interface WikiPlace extends DestinationInfo {
  lat?: number;
  lon?: number;
}

const cache = new Map<string, Promise<WikiPlace | null>>();

async function lookup(place: string, signal: AbortSignal): Promise<WikiPlace | null> {
  // Find the best-matching article title first; the summary endpoint needs an exact title.
  const search = new URLSearchParams({
    action: "opensearch",
    search: place,
    limit: "1",
    namespace: "0",
    format: "json",
  });
  const sres = await fetch(`https://en.wikipedia.org/w/api.php?${search}`, { headers: HEADERS, signal });
  if (!sres.ok) throw new Error(`Wikipedia search failed (${sres.status})`);
  const title: string | undefined = (await sres.json())?.[1]?.[0];
  if (!title) return null;

  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    { headers: HEADERS, signal }
  );
  if (!res.ok) throw new Error(`Wikipedia summary failed (${res.status})`);
  const page = await res.json();
  if (page.type !== "standard" || !page.extract) return null;

  // Keep the intro to two sentences.
  const sentences: string[] = page.extract.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [page.extract];
  return {
    title: page.title,
    extract: sentences.slice(0, 2).join("").trim(),
    image: page.thumbnail?.source,
    url: page.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    lat: page.coordinates?.lat,
    lon: page.coordinates?.lon,
  };
}

export function getWikiPlace(place: string, signal: AbortSignal): Promise<WikiPlace | null> {
  const k = place.trim().toLowerCase();
  let p = cache.get(k);
  if (!p) {
    p = lookup(place, signal);
    cache.set(k, p);
    // Don't keep failures around; the next search can retry.
    p.catch(() => cache.delete(k));
  }
  return p;
}
