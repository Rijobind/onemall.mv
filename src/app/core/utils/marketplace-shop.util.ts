export interface ProductShopFields {
  store_id: string;
  store_name: string;
  shop_atoll: string;
  shop_city: string;
  shop_location: string;
}

export function normalizeId(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

export function resolveStoreIdFromProduct(product: any, variant?: any): string {
  const candidate =
    product?.store_id ??
    product?.storeId ??
    variant?.store_id ??
    variant?.storeId ??
    variant?.im_StoreVariantInventory?.[0]?.store_id ??
    variant?.im_StoreVariantInventory?.[0]?.storeId ??
    '';
  return normalizeId(candidate);
}

export function resolveStoreRegionFromProduct(product: any): {
  atoll: string;
  city: string;
} {
  const region = product?.store_region ?? product?.storeRegion ?? {};
  return {
    atoll: normalizeId(region?.region_name ?? region?.regionName),
    city: normalizeId(region?.city ?? region?.City),
  };
}

export function formatShopLocation(atoll?: string, city?: string): string {
  const atollName = String(atoll || '').trim();
  const cityName = String(city || '').trim();
  if (atollName && cityName) return `${atollName} · ${cityName}`;
  return atollName || cityName || '';
}

export function extractShopFieldsFromApiProduct(
  product: any,
  variant?: any,
  storeName = ''
): ProductShopFields {
  const store_id = resolveStoreIdFromProduct(product, variant);
  const { atoll, city } = resolveStoreRegionFromProduct(product);
  return {
    store_id,
    store_name: storeName || 'Shop',
    shop_atoll: atoll,
    shop_city: city,
    shop_location: formatShopLocation(atoll, city),
  };
}

export function resolveStoreAddressRegion(store: any): { atoll: string; city: string } {
  const addressRaw = store?.st_StoresAddres ?? store?.st_storesAddres ?? store?.address;
  const address = Array.isArray(addressRaw) ? addressRaw[0] : addressRaw;
  return {
    atoll: String(address?.region || store?.region || '').trim(),
    city: String(address?.city || store?.city || store?.store_location || '').trim(),
  };
}
