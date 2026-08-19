import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environments';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, switchMap, of, catchError, shareReplay, throwError } from 'rxjs';
import { MarketplaceProductParams } from '../region.service/region.service';
import { extractApiList, isApiSuccess } from '../../utils/api-response.util';

@Injectable({
  providedIn: 'root',
})
export class BackendapiServices {
  apiUrl: string = environment.ApiUrl;
  private categoriesCache$: Observable<any> | null = null;
  private marketplaceProductsCache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  getAllCategoryList(): Observable<any> {
    if (this.categoriesCache$) {
      return this.categoriesCache$;
    }

    this.categoriesCache$ = this.http.get(`${this.apiUrl}/Category/product_category_list`).pipe(
      catchError((err) => {
        this.categoriesCache$ = null;
        return throwError(() => err);
      }),
      shareReplay(1)
    );
    return this.categoriesCache$;
  }

  private toMarketplaceHttpParams(params?: MarketplaceProductParams): HttpParams {
    let httpParams = new HttpParams();
    if (params?.country_region_id) {
      httpParams = httpParams.set('country_region_id', params.country_region_id);
    }
    if (params?.region_name) {
      httpParams = httpParams.set('region_name', params.region_name);
    }
    if (params?.city) {
      httpParams = httpParams.set('city', params.city);
    }
    if (params?.currency_code) {
      httpParams = httpParams.set('currency_code', params.currency_code);
    }
    if (params?.user_id) {
      httpParams = httpParams.set('user_id', params.user_id);
    }
    if (params?.country_code) {
      httpParams = httpParams.set('country_code', params.country_code);
    }
    return httpParams;
  }

  getMarketplaceProducts(params?: MarketplaceProductParams): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/get_marketplace_products`, {
      params: this.toMarketplaceHttpParams(params),
    });
  }

  /** Single product by SEO slug. */
  getMarketplaceProductBySlug(
    slug: string,
    params?: MarketplaceProductParams
  ): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/product/by-slug/${encodeURIComponent(slug)}`,
      { params: this.toMarketplaceHttpParams(params) }
    );
  }

  /** Single product by product_id. */
  getMarketplaceProductById(
    productId: string,
    params?: MarketplaceProductParams
  ): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/product/${encodeURIComponent(productId)}`,
      { params: this.toMarketplaceHttpParams(params) }
    );
  }

  /** Resolve canonical slug / product_id. */
  resolveMarketplaceProduct(query: {
    product_id?: string;
    slug?: string;
  } & MarketplaceProductParams): Observable<any> {
    let httpParams = this.toMarketplaceHttpParams(query);
    if (query.product_id) {
      httpParams = httpParams.set('product_id', query.product_id);
    }
    if (query.slug) {
      httpParams = httpParams.set('slug', query.slug);
    }
    return this.http.get(`${this.apiUrl}/Market_place/product/resolve`, {
      params: httpParams,
    });
  }

  getMarketplaceProductsWithFallback(params?: MarketplaceProductParams): Observable<any> {
    const cacheKey = this.buildProductParamsCacheKey(params);
    const cached = this.marketplaceProductsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const request$ = this.getMarketplaceProducts(params).pipe(
      switchMap((res: any) => {
        if (isApiSuccess(res) && extractApiList(res).length > 0) {
          return of(res);
        }
        if (
          !params?.country_region_id &&
          !params?.region_name &&
          !params?.city &&
          !params?.currency_code
        ) {
          return of(res);
        }
        // Keep currency/user when falling back from empty region results.
        return this.getMarketplaceProducts({
          currency_code: params?.currency_code,
          user_id: params?.user_id,
          country_code: params?.country_code,
        });
      }),
      catchError(() =>
        this.getMarketplaceProducts({
          currency_code: params?.currency_code,
          user_id: params?.user_id,
          country_code: params?.country_code,
        })
      ),
      catchError((err) => {
        this.marketplaceProductsCache.delete(cacheKey);
        return throwError(() => err);
      }),
      shareReplay(1)
    );
    this.marketplaceProductsCache.set(cacheKey, request$);
    return request$;
  }

  /** Clear cached marketplace product responses (e.g. after currency change). */
  clearMarketplaceProductsCache(): void {
    this.marketplaceProductsCache.clear();
  }

  private buildProductParamsCacheKey(params?: MarketplaceProductParams): string {
    const normalized = {
      country_region_id: String(params?.country_region_id || '').trim(),
      region_name: String(params?.region_name || '').trim(),
      city: String(params?.city || '').trim(),
      currency_code: String(params?.currency_code || '').trim().toUpperCase(),
      user_id: String(params?.user_id || '').trim(),
      country_code: String(params?.country_code || '').trim().toUpperCase(),
    };
    return JSON.stringify(normalized);
  }

  getMarketplaceRegions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/get_marketplace_regions`);
  }

  getMarketplaceCities(countryRegionId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/get_marketplace_cities/${countryRegionId}`
    );
  }

  getMarketplaceCurrencies(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/currencies`);
  }

  getMarketplaceCountries(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/countries`);
  }

  saveCustomerCurrencyPreference(payload: {
    user_id: string;
    currency: string;
    country_id?: string | null;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/customer/preferences`, payload);
  }

  getAdminRegionsList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Admin/regions_list`);
  }

  getstores(store_id: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/store/get_sotore_deatils/${store_id}`);
  }

  registerCustomer(payload: {
    full_name: string;
    email: string;
    country_code: string;
    phone_number: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/register_customer`, payload);
  }

  requestOtp(payload: {
    country_code: string;
    phone_number: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/request_otp`, payload);
  }

  verifyOtp(payload: {
    country_code: string;
    phone_number: string;
    otp: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/verify_otp`, payload);
  }

  refreshCustomerToken(payload: { refresh_token: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/refresh_customer_token`, payload);
  }

  getCustomerMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/customer/me`);
  }

  presignCustomerProfileImage(payload: {
    content_type: string;
    file_ext: string;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/Market_place/customer/profile-image/presign`,
      payload
    );
  }

  confirmCustomerProfileImage(payload: {
    object_key: string;
    public_url: string;
  }): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/Market_place/customer/profile-image`,
      payload
    );
  }

  deleteCustomerProfileImage(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Market_place/customer/profile-image`);
  }

  /** Customer cart — all require Bearer customer token. */
  getCustomerCart(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/cart`);
  }

  upsertCustomerCartItem(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/cart/items`, payload);
  }

  updateCustomerCartItem(
    cartItemId: string,
    payload: Record<string, unknown>
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/Market_place/cart/items/${encodeURIComponent(cartItemId)}`,
      payload
    );
  }

  updateCustomerCartItemByLine(
    cartLineId: string,
    payload: Record<string, unknown>
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/Market_place/cart/items/by-line/${encodeURIComponent(cartLineId)}`,
      payload
    );
  }

  deleteCustomerCartItem(cartItemId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/cart/items/${encodeURIComponent(cartItemId)}`
    );
  }

  deleteCustomerCartItemByLine(cartLineId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/cart/items/by-line/${encodeURIComponent(cartLineId)}`
    );
  }

  syncCustomerCart(payload: { items: unknown[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/cart/sync`, payload);
  }

  clearCustomerCart(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Market_place/cart`);
  }

  /** Create customer quotation (quote-request, not payment). */
  createQuotation(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/quotations`, payload);
  }

  /** Alias route for quote-only wording (same contract as quotations). */
  createQuote(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/quotes`, payload);
  }

  getCustomerQuotations(params?: {
    status?: string;
    page?: number;
    page_size?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.page_size != null) {
      httpParams = httpParams.set('page_size', String(params.page_size));
    }
    return this.http.get(`${this.apiUrl}/Market_place/quotations`, {
      params: httpParams,
    });
  }

  getCustomerQuotationById(quotationId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/quotations/${encodeURIComponent(quotationId)}`
    );
  }

  /** Customer favorites — JWT-scoped. */
  getCustomerFavorites(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/favorites`);
  }

  addCustomerFavorite(payload: { product_id: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/favorites`, payload);
  }

  deleteCustomerFavorite(productId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/favorites/${encodeURIComponent(productId)}`
    );
  }

  bulkSyncCustomerFavorites(payload: {
    product_ids: string[];
    merge_strategy: 'union';
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/favorites/bulk-sync`, payload);
  }

  /** Customer store follows — JWT-scoped (customer_id from token only). */
  getCustomerFollows(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/follows`);
  }

  followStore(payload: { store_id: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/follows`, payload);
  }

  unfollowStore(storeId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/follows/${encodeURIComponent(storeId)}`
    );
  }

  getStoreFollowStatus(storeId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/stores/${encodeURIComponent(storeId)}/follow-status`
    );
  }

  getStoreFollowers(params: {
    store_id: string;
    page?: number;
    page_size?: number;
  }): Observable<any> {
    let httpParams = new HttpParams().set('store_id', params.store_id);
    if (params.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params.page_size != null) {
      httpParams = httpParams.set('page_size', String(params.page_size));
    }
    return this.http.get(`${this.apiUrl}/Market_place/store/followers`, {
      params: httpParams,
    });
  }

  getStoreFollowersCount(storeId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/store/followers/count`, {
      params: new HttpParams().set('store_id', storeId),
    });
  }

  /** Customer in-app notifications. */
  getCustomerNotifications(params?: {
    unread_only?: boolean;
    page?: number;
    page_size?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.unread_only === true) {
      httpParams = httpParams.set('unread_only', 'true');
    }
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.page_size != null) {
      httpParams = httpParams.set('page_size', String(params.page_size));
    }
    return this.http.get(`${this.apiUrl}/Market_place/notifications`, {
      params: httpParams,
    });
  }

  getCustomerNotificationUnreadCount(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/notifications/unread-count`);
  }

  markCustomerNotificationRead(notificationId: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/Market_place/notifications/${encodeURIComponent(notificationId)}/read`,
      {}
    );
  }

  markAllCustomerNotificationsRead(): Observable<any> {
    return this.http.put(`${this.apiUrl}/Market_place/notifications/read-all`, {});
  }

  deleteCustomerNotification(notificationId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/notifications/${encodeURIComponent(notificationId)}`
    );
  }

  /** Customer shipping addresses — JWT-scoped (never send mk_customer_id). */
  customerHasAddresses(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/customer/addresses/has`);
  }

  getCustomerAddresses(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/customer/addresses`);
  }

  getCustomerAddressById(addressId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/customer/addresses/${encodeURIComponent(addressId)}`
    );
  }

  createCustomerAddress(payload: Record<string, unknown>): Observable<any> {
    return this.http.post(`${this.apiUrl}/Market_place/customer/addresses`, payload);
  }

  updateCustomerAddress(
    addressId: string,
    payload: Record<string, unknown>
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/Market_place/customer/addresses/${encodeURIComponent(addressId)}`,
      payload
    );
  }

  setCustomerAddressDefault(addressId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/Market_place/customer/addresses/${encodeURIComponent(addressId)}/default`,
      {}
    );
  }

  deleteCustomerAddress(addressId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/Market_place/customer/addresses/${encodeURIComponent(addressId)}`
    );
  }

  extractProductsFromResponse(response: any): any[] {
    if (!isApiSuccess(response)) return [];
    return extractApiList(response);
  }
}
