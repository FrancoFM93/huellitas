// lib/geoSlug.ts
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ParsedCity { city_slug: string; region?: string; country?: string }

export function parseCityInput(city: string, region?: string, country?: string): ParsedCity {
  return { city_slug: slugify(city), region, country: country?.toUpperCase() }
}
