/**
 * SEO product URL helpers.
 * Canonical path: /product/{slug}
 * Fallback path segment may be product_id (PDP resolves via by-id).
 */

/** Accepts standard GUID / UUID including v7 (common in .NET). */
export function isProductGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

/**
 * Backend by-slug rejects unsafe values ("Invalid slug").
 * Only allow lowercase kebab segments the API will accept.
 */
export function isSafeProductSlug(value: string): boolean {
  const slug = String(value || '').trim();
  if (!slug || isProductGuid(slug)) return false;
  // no consecutive dashes, only [a-z0-9-]
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) && !/--/.test(slug);
}

/** Last 8 hex chars from slug suffix (backend format: {kebab}-{first8OfGuid}). */
export function extractSlugGuidPrefix(slug: string): string {
  const match = String(slug || '')
    .trim()
    .match(/-([0-9a-fA-F]{8})$/);
  return match ? match[1].toLowerCase() : '';
}

export function productIdMatchesSlugPrefix(
  productId: string,
  slugPrefix: string
): boolean {
  const id = String(productId || '')
    .replace(/-/g, '')
    .toLowerCase();
  const prefix = String(slugPrefix || '')
    .replace(/-/g, '')
    .toLowerCase();
  return !!prefix && id.startsWith(prefix);
}

/**
 * Prefer a safe SEO slug; otherwise use product_id so PDP can load via by-id.
 */
export function resolveProductSlug(product: {
  slug?: string | null;
  id?: string | number | null;
  product_id?: string | number | null;
  productId?: string | number | null;
} | null | undefined): string {
  const slug = String(product?.slug ?? '').trim();
  const id = String(
    product?.id ?? product?.product_id ?? product?.productId ?? ''
  ).trim();

  if (slug && isSafeProductSlug(slug)) return slug;
  return id || slug;
}

export function buildProductCommands(product: {
  slug?: string | null;
  id?: string | number | null;
  product_id?: string | number | null;
  productId?: string | number | null;
  store_id?: string | null;
  storeId?: string | null;
}): { commands: string[]; queryParams?: { store_id: string } } {
  const segment = resolveProductSlug(product);
  const storeId = String(product?.store_id ?? product?.storeId ?? '').trim();
  return {
    commands: segment ? ['/product', segment] : ['/product-details'],
    queryParams: storeId ? { store_id: storeId } : undefined,
  };
}
