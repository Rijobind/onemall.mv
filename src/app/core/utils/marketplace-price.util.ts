/**
 * Backend-driven display pricing.
 * Frontend must NOT convert FX — only render display_* fields from the API.
 */

export interface VariantDisplayPrice {
  /** Customer-facing converted amount (display_price). */
  price: number;
  /** Optional original amount for "Original: 100 USD". */
  originalPrice: number;
  display_currency: string;
  display_symbol: string;
  original_currency: string;
  /** Stored catalog price — never overwrite / never use for FX. */
  base_price: number;
  exchange_rate_used?: number;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Prefer variant-level display fields; fall back to product-level, then base_price.
 */
export function resolveVariantDisplayPrice(variant?: any, product?: any): VariantDisplayPrice {
  const base_price = toFiniteNumber(
    variant?.base_price ?? product?.fixed_price ?? product?.base_price,
    0
  );

  const displayRaw = variant?.display_price ?? product?.display_price;
  const hasDisplay = displayRaw != null && String(displayRaw).trim() !== '';
  const displayPrice = hasDisplay ? toFiniteNumber(displayRaw, base_price) : base_price;

  const originalRaw = variant?.original_price ?? product?.original_price;
  const hasOriginal = originalRaw != null && String(originalRaw).trim() !== '';
  const originalPrice = hasOriginal ? toFiniteNumber(originalRaw, 0) : 0;

  const display_currency = String(
    variant?.display_currency ?? product?.display_currency ?? ''
  )
    .trim()
    .toUpperCase();

  const original_currency = String(
    variant?.original_currency ?? product?.original_currency ?? ''
  )
    .trim()
    .toUpperCase();

  const display_symbol =
    String(variant?.display_symbol ?? product?.display_symbol ?? '')
      .trim() || (display_currency ? display_currency : '$');

  const rateRaw = variant?.exchange_rate_used ?? product?.exchange_rate_used;
  const exchange_rate_used =
    rateRaw != null && String(rateRaw).trim() !== ''
      ? toFiniteNumber(rateRaw, NaN)
      : undefined;

  return {
    price: displayPrice,
    originalPrice,
    display_currency,
    display_symbol,
    original_currency,
    base_price,
    exchange_rate_used: Number.isFinite(exchange_rate_used as number)
      ? (exchange_rate_used as number)
      : undefined,
  };
}

export function formatOriginalPriceHint(fields: VariantDisplayPrice): string {
  if (!fields.originalPrice || !fields.original_currency) return '';
  if (
    fields.original_currency === fields.display_currency &&
    fields.originalPrice === fields.price
  ) {
    return '';
  }
  return `Original: ${fields.originalPrice} ${fields.original_currency}`;
}
