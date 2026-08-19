import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { AuthService } from '../auth.service/auth.service';
import { extractApiData, extractApiList } from '../../utils/api-response.util';

export interface FavoriteProduct {
  id: string;
  slug?: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  inStock: boolean;
  store_id?: string;
  store_name?: string;
  shop_location?: string;
  store_currency_code?: string;
  store_currency_symbol?: string;
  rating?: number;
  reviews?: number;
  brand?: string;
  delivery?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly storageKey = 'favorite_products';
  private readonly favoritesSubject = new BehaviorSubject<FavoriteProduct[]>(
    this.loadFromStorage()
  );
  private syncInFlight$: Observable<FavoriteProduct[]> | null = null;
  private loadInFlight$: Observable<FavoriteProduct[]> | null = null;

  readonly favorites$ = this.favoritesSubject.asObservable();

  constructor(
    private api: BackendapiServices,
    private authService: AuthService
  ) {
    if (typeof window !== 'undefined') {
      // Fired only after OTP verify (fresh login), not on token refresh alone.
      window.addEventListener('auth-login', this.handleAuthLogin);
      window.addEventListener('auth-updated', this.handleAuthUpdated);
    }

    // Guests must not keep leftover favorites from a previous session.
    if (!this.isAuthenticated()) {
      this.favoritesSubject.next([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }
    }
  }

  getFavorites(): FavoriteProduct[] {
    return this.favoritesSubject.getValue();
  }

  getCount(): number {
    return this.getFavorites().length;
  }

  isFavorite(id: string | number | null | undefined): boolean {
    const normalizedId = String(id ?? '');
    if (!normalizedId) return false;
    return this.getFavorites().some((item) => String(item.id) === normalizedId);
  }

  toggle(product: Partial<FavoriteProduct> & { id: string | number }): boolean | 'login_required' {
    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return 'login_required';
    }
    if (this.isFavorite(product.id)) {
      this.remove(product.id);
      return false;
    }
    this.add(product);
    return true;
  }

  add(product: Partial<FavoriteProduct> & { id: string | number }): boolean {
    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return false;
    }

    const normalizedId = String(product.id ?? '');
    if (!normalizedId || this.isFavorite(normalizedId)) return false;

    const newItem: FavoriteProduct = {
      id: normalizedId,
      slug: product.slug ? String(product.slug).trim() : undefined,
      name: product.name || 'Untitled Product',
      price: Number(product.price) || 0,
      originalPrice: Number(product.originalPrice) || 0,
      image: product.image || '/mobile.jpg',
      inStock: product.inStock !== false,
      store_id: product.store_id ? String(product.store_id) : undefined,
      store_name: product.store_name ? String(product.store_name) : undefined,
      shop_location: product.shop_location ? String(product.shop_location) : undefined,
      store_currency_code: product.store_currency_code
        ? String(product.store_currency_code).trim().toUpperCase()
        : undefined,
      store_currency_symbol: product.store_currency_symbol
        ? String(product.store_currency_symbol)
        : undefined,
      rating: product.rating,
      reviews: product.reviews,
      brand: product.brand,
      delivery: product.delivery,
    };

    this.persist([...this.getFavorites(), newItem]);
    this.api
      .addCustomerFavorite({ product_id: normalizedId })
      .pipe(catchError(() => of(null)))
      .subscribe();
    return true;
  }

  remove(id: string | number): boolean {
    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return false;
    }

    const normalizedId = String(id ?? '');
    if (!normalizedId) return false;

    const updated = this.getFavorites().filter(
      (item) => String(item.id) !== normalizedId
    );
    this.persist(updated);
    this.api
      .deleteCustomerFavorite(normalizedId)
      .pipe(catchError(() => of(null)))
      .subscribe();
    return true;
  }

  /** True when customer has an active or restorable session. */
  isAuthenticated(): boolean {
    return this.authService.isLoggedIn || this.authService.hasSavedSession;
  }

  /** Ask the header to open the sign-in modal. */
  requestSignIn(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('open-signin'));
  }

  /** Clear local favorites mirror (e.g. on logout). */
  clearLocal(): void {
    this.persist([]);
  }

  fromListProduct(product: any): Partial<FavoriteProduct> & { id: string | number } {
    return {
      id: product?.id,
      slug: product?.slug ? String(product.slug).trim() : undefined,
      name: product?.name || 'Untitled Product',
      price: Number(product?.price) || 0,
      originalPrice: Number(product?.originalPrice) || 0,
      image: product?.image || '/mobile.jpg',
      inStock: product?.inStock !== false,
      store_id: product?.store_id ? String(product.store_id) : undefined,
      store_name: product?.store_name ? String(product.store_name) : undefined,
      shop_location: product?.shop_location ? String(product.shop_location) : undefined,
      store_currency_code: product?.store_currency_code
        ? String(product.store_currency_code).trim().toUpperCase()
        : undefined,
      store_currency_symbol: product?.store_currency_symbol
        ? String(product.store_currency_symbol)
        : undefined,
      rating: product?.rating,
      reviews: product?.reviews,
      brand: product?.brand,
      delivery: product?.delivery,
    };
  }

  fromDetailsProduct(
    product: any,
    image?: string,
    storeId?: string
  ): Partial<FavoriteProduct> & { id: string | number } {
    return {
      id: product?.id,
      slug: product?.slug ? String(product.slug).trim() : undefined,
      name: product?.name || 'Untitled Product',
      price: Number(product?.price) || 0,
      originalPrice: Number(product?.originalPrice) || 0,
      image: image || product?.images?.[0] || '/mobile.jpg',
      inStock: product?.inStock !== false,
      store_id: storeId ? String(storeId) : undefined,
      rating: product?.rating,
      reviews: product?.reviews,
      brand: product?.brand,
    };
  }

  /**
   * Load favorites from backend for the logged-in customer.
   * Call after session restore and when opening the favorites page.
   */
  loadFromServer(): Observable<FavoriteProduct[]> {
    // Allow call when refresh token exists even if access token expired —
    // auth interceptor will refresh and retry.
    if (!this.authService.isLoggedIn && !this.authService.hasSavedSession) {
      return of(this.getFavorites());
    }
    if (this.loadInFlight$) {
      return this.loadInFlight$;
    }

    this.loadInFlight$ = this.api.getCustomerFavorites().pipe(
      map((res) => this.mapApiList(res)),
      tap((items) => this.persist(items)),
      catchError(() => of(this.getFavorites())),
      tap(() => {
        this.loadInFlight$ = null;
      })
    );

    return this.loadInFlight$;
  }

  /**
   * Fresh login: merge guest local favorites into DB (union), then mirror server list.
   * If guest has no favorites, just load server favorites (cross-device case).
   */
  handleLoginFavorites(): Observable<FavoriteProduct[]> {
    if (!this.authService.isLoggedIn) {
      return of(this.getFavorites());
    }

    const localIds = this.getFavorites()
      .map((item) => String(item?.id || '').trim())
      .filter(Boolean);

    if (localIds.length > 0) {
      return this.syncGuestFavorites(Array.from(new Set(localIds)));
    }
    return this.loadFromServer();
  }

  private syncGuestFavorites(productIds: string[]): Observable<FavoriteProduct[]> {
    if (this.syncInFlight$) {
      return this.syncInFlight$;
    }

    this.syncInFlight$ = this.api
      .bulkSyncCustomerFavorites({
        product_ids: productIds,
        merge_strategy: 'union',
      })
      .pipe(
        map((res) => this.mapApiList(res)),
        tap((items) => this.persist(items)),
        catchError(() => this.loadFromServer()),
        tap(() => {
          this.syncInFlight$ = null;
        })
      );

    return this.syncInFlight$;
  }

  private readonly handleAuthLogin = () => {
    this.handleLoginFavorites().subscribe();
  };

  private readonly handleAuthUpdated = () => {
    // Logout / session cleared → wipe local favorites so guests cannot keep them.
    if (!this.isAuthenticated()) {
      this.clearLocal();
    }
  };

  private persist(items: FavoriteProduct[]): void {
    if (typeof window === 'undefined') {
      this.favoritesSubject.next(items);
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.favoritesSubject.next(items);
    window.dispatchEvent(new Event('favorites-updated'));
  }

  private mapApiList(res: any): FavoriteProduct[] {
    return this.extractList(res)
      .map((item) => this.mapServerFavorite(item))
      .filter((item): item is FavoriteProduct => !!item);
  }

  private extractList(res: any): any[] {
    const data = extractApiData(res) ?? res?.data ?? res?.Data ?? res;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.Items)) return data.Items;
    if (Array.isArray(data?.favorites)) return data.favorites;
    if (Array.isArray(data?.Favorites)) return data.Favorites;
    return extractApiList(res);
  }

  private mapServerFavorite(item: any): FavoriteProduct | null {
    const productId = String(
      item?.product_id ?? item?.productId ?? item?.id ?? ''
    ).trim();
    if (!productId) return null;

    const price = Number(item?.price ?? item?.unit_price ?? 0);
    return {
      id: productId,
      slug: item?.slug ? String(item.slug).trim() : undefined,
      name:
        item?.product_name ||
        item?.productName ||
        item?.name ||
        item?.title ||
        'Untitled Product',
      price: Number.isFinite(price) ? price : 0,
      originalPrice: Number(item?.original_price ?? item?.originalPrice) || 0,
      image:
        item?.image_url ||
        item?.imageUrl ||
        item?.image ||
        item?.thumbnail_url ||
        '/mobile.jpg',
      inStock: item?.inStock !== false && item?.in_stock !== false,
      store_id: item?.store_id
        ? String(item.store_id)
        : item?.storeId
          ? String(item.storeId)
          : undefined,
      store_name: item?.store_name
        ? String(item.store_name)
        : item?.storeName
          ? String(item.storeName)
          : undefined,
      store_currency_code: item?.currency_code
        ? String(item.currency_code).trim().toUpperCase()
        : item?.store_currency_code
          ? String(item.store_currency_code).trim().toUpperCase()
          : undefined,
      store_currency_symbol: item?.currency_symbol
        ? String(item.currency_symbol)
        : item?.store_currency_symbol
          ? String(item.store_currency_symbol)
          : undefined,
    };
  }

  private loadFromStorage(): FavoriteProduct[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item?.id != null)
        .map((item) => ({
          id: String(item.id),
          slug: item.slug ? String(item.slug).trim() : undefined,
          name: item.name || 'Untitled Product',
          price: Number(item.price) || 0,
          originalPrice: Number(item.originalPrice) || 0,
          image: item.image || '/mobile.jpg',
          inStock: item.inStock !== false,
          store_id: item.store_id ? String(item.store_id) : undefined,
          store_name: item.store_name ? String(item.store_name) : undefined,
          shop_location: item.shop_location ? String(item.shop_location) : undefined,
          store_currency_code: item.store_currency_code
            ? String(item.store_currency_code).trim().toUpperCase()
            : undefined,
          store_currency_symbol: item.store_currency_symbol
            ? String(item.store_currency_symbol)
            : undefined,
          rating: item.rating,
          reviews: item.reviews,
          brand: item.brand,
          delivery: item.delivery,
        }));
    } catch {
      return [];
    }
  }
}
