import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import {
  extractShopFieldsFromApiProduct,
  formatShopLocation,
  normalizeId,
  resolveCurrencySymbol,
  resolveStoreAddressRegion,
  resolveStoreIdFromProduct,
} from '../../utils/marketplace-shop.util';

interface StoreCacheEntry {
  name: string;
  atoll: string;
  city: string;
  location: string;
  default_currency: string;
  currency_symbol: string;
}

@Injectable({
  providedIn: 'root',
})
export class MarketplaceShopService {
  private readonly cache = new Map<string, StoreCacheEntry>();

  constructor(
    private api: BackendapiServices,
    private router: Router
  ) {}

  mapApiProductShopFields(product: any, variant?: any): ReturnType<typeof extractShopFieldsFromApiProduct> {
    const storeId = resolveStoreIdFromProduct(product, variant);
    const cached = storeId ? this.cache.get(storeId) : undefined;
    const base = extractShopFieldsFromApiProduct(product, variant, cached?.name || '');
    if (cached?.location && !base.shop_location) {
      base.shop_location = cached.location;
      base.shop_atoll = base.shop_atoll || cached.atoll;
      base.shop_city = base.shop_city || cached.city;
    }
    base.store_currency_code = cached?.default_currency || '';
    base.store_currency_symbol = cached?.currency_symbol || '$';
    return base;
  }

  enrichWithShopNames<
    T extends {
      store_id?: string;
      shop_atoll?: string;
      shop_city?: string;
      shop_location?: string;
      store_currency_code?: string;
      store_currency_symbol?: string;
    },
  >(
    items: T[]
  ): Observable<T[]> {
    const storeIds = [
      ...new Set(items.map((item) => normalizeId(item.store_id)).filter(Boolean)),
    ];
    if (!storeIds.length) {
      return of(items);
    }

    return forkJoin(storeIds.map((storeId) => this.loadStoreEntry(storeId))).pipe(
      map(() =>
        items.map((item) => {
          const storeId = normalizeId(item.store_id);
          const cached = storeId ? this.cache.get(storeId) : undefined;
          const atoll = item.shop_atoll || cached?.atoll || '';
          const city = item.shop_city || cached?.city || '';
          return {
            ...item,
            store_name: cached?.name || (item as any).store_name || 'Shop',
            shop_atoll: atoll,
            shop_city: city,
            shop_location: formatShopLocation(atoll, city) || item.shop_location || cached?.location || '',
            store_currency_code:
              (item as any).store_currency_code || cached?.default_currency || '',
            store_currency_symbol:
              (item as any).store_currency_symbol || cached?.currency_symbol || '$',
          } as T;
        })
      )
    );
  }

  navigateToShop(storeId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const normalizedId = normalizeId(storeId);
    if (!normalizedId) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('store_id', normalizedId);
    }

    this.router.navigate(['/shop-details'], {
      queryParams: { store_id: normalizedId },
    });
  }

  getStoreLocationLabel(storeId: string, fallbackAtoll = '', fallbackCity = ''): string {
    const cached = this.cache.get(normalizeId(storeId));
    if (cached?.location) return cached.location;
    return formatShopLocation(fallbackAtoll, fallbackCity);
  }

  private loadStoreEntry(storeId: string): Observable<StoreCacheEntry> {
    const normalizedId = normalizeId(storeId);
    const cached = this.cache.get(normalizedId);
    if (cached) {
      return of(cached);
    }

    return this.api.getstores(normalizedId).pipe(
      map((response: any) => {
        const payload = response?.data ?? response ?? {};
        const store = Array.isArray(payload) ? payload[0] : payload;
        const { atoll, city } = resolveStoreAddressRegion(store);
        const entry: StoreCacheEntry = {
          name: String(store?.store_name || store?.name || 'Shop').trim() || 'Shop',
          atoll,
          city,
          location: formatShopLocation(atoll, city) || String(store?.store_location || '').trim(),
          default_currency: String(store?.default_currency || '').trim().toUpperCase(),
          currency_symbol: resolveCurrencySymbol(store?.default_currency),
        };
        this.cache.set(normalizedId, entry);
        return entry;
      }),
      catchError(() => {
        const entry: StoreCacheEntry = {
          name: 'Shop',
          atoll: '',
          city: '',
          location: '',
          default_currency: '',
          currency_symbol: '$',
        };
        this.cache.set(normalizedId, entry);
        return of(entry);
      })
    );
  }
}
