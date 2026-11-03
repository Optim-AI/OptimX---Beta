/** Links to Meta's public Ad Library (safe for the browser bundle). */

const COUNTRY_CODES: Record<string, string> = {
  india: "IN", "united states": "US", usa: "US", us: "US", america: "US", "united kingdom": "GB", uk: "GB",
  canada: "CA", australia: "AU", germany: "DE", france: "FR", spain: "ES", italy: "IT", netherlands: "NL",
  ireland: "IE", singapore: "SG", "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", indonesia: "ID",
  brazil: "BR", mexico: "MX", japan: "JP", "south africa": "ZA", "new zealand": "NZ", sweden: "SE",
};

export function countryCodeFor(market: string | undefined): string {
  const m = (market || "").toLowerCase();
  // Whole words only: "australia" must not match "us".
  for (const [name, code] of Object.entries(COUNTRY_CODES)) if (new RegExp(`\\b${name}\\b`).test(m)) return code;
  return "ALL";
}

export function adLibrarySearchUrl(name: string, country: string): string {
  const p = new URLSearchParams({ active_status: "active", ad_type: "all", country, q: name, search_type: "keyword_unordered" });
  return `https://www.facebook.com/ads/library/?${p}`;
}
