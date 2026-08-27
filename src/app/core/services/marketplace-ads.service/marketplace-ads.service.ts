import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { MarketplaceShopService } from '../marketplace-shop.service/marketplace-shop.service';
import { extractApiData, extractApiList } from '../../utils/api-response.util';
import { buildProductCommands } from '../../utils/product-url.util';

export type MarketplaceAdSlot =
  | 'global_header'
  | 'home_hero'
  | 'home_side_deals'
  | 'home_new_arrival'
  | 'home_mid_banner'
  | 'brand_partners'
  | 'listing_banner'
  | 'profile_product_details';

/** Slots the API shuffles per request — always fetch fresh on page load. */
const FRESH_SLOTS: ReadonlySet<MarketplaceAdSlot> = new Set([
  'listing_banner',
  'profile_product_details',
]);

export interface MarketplaceAdShop {
  id: string;
  name: string;
  business_name: string;
  logo: string;
  location: string;
  focused_categories: string[];
}

export interface MarketplaceAdProduct {
  id: string;
  slug: string;
  name: string;
  thumbnail: string;
  category: string;
  rating: number;
  price: number;
  currency_symbol: string;
}

export interface MarketplaceAd {
  id: string;
  slot: string;
  position: string;
  sort_order: number;
  shop_id: string;
  product_id: string;
  image: string;
  image_desktop: string;
  image_mobile: string;
  logo: string;
  shop_link: string;
  offer: string;
  discount: string;
  title: string;
  description: string;
  button_text: string;
  shop: MarketplaceAdShop | null;
  product: MarketplaceAdProduct | null;
  is_active?: boolean | string;
}

export interface MarketplaceHomeAds {
  home_hero: MarketplaceAd[];
  home_side_deals: MarketplaceAd[];
  home_new_arrival: MarketplaceAd[];
  home_mid_banner: MarketplaceAd[];
  brand_partners: MarketplaceAd[];
}

const EMPTY_HOME_ADS: MarketplaceHomeAds = {
  home_hero: [],
  home_side_deals: [],
  home_new_arrival: [],
  home_mid_banner: [],
  brand_partners: [],
};

@Injectable({
  providedIn: 'root',
})
export class MarketplaceAdsService {
  private homeAds$?: Observable<MarketplaceHomeAds>;
  private readonly slotAds$ = new Map<string, Observable<MarketplaceAd[]>>();
  private readonly storeDetails$ = new Map<string, Observable<any>>();
  private companyStoreIdCache = new Map<string, string>();

  constructor(
    private api: BackendapiServices,
    private router: Router,
    private shopService: MarketplaceShopService
  ) {}

  getHomeAds(): Observable<MarketplaceHomeAds> {
    if (!this.homeAds$) {
      this.homeAds$ = this.api.getMarketplaceHomeAds().pipe(
        map((res) => this.mapHomeAds(extractApiData(res) ?? res)),
        switchMap((home) => this.fillEmptyHomeSlots(home)),
        switchMap((home) => this.enrichHomeAdsShops(home)),
        catchError(() => of(EMPTY_HOME_ADS)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.homeAds$;
  }

  getAdsBySlot(slot: MarketplaceAdSlot): Observable<MarketplaceAd[]> {
    const fresh = FRESH_SLOTS.has(slot);
    if (!fresh) {
      const cached = this.slotAds$.get(slot);
      if (cached) return cached;
    }

    const request$ = this.api.getMarketplaceAdsBySlot(slot).pipe(
      map((res) => this.mapAdList(this.extractSlotPayload(res, slot))),
      switchMap((ads) => this.enrichAdListShops(ads)),
      catchError(() => of([] as MarketplaceAd[])),
      tap((ads) => {
        if (!ads.length) this.slotAds$.delete(slot);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    if (!fresh) {
      this.slotAds$.set(slot, request$);
    }
    return request$;
  }

  desktopImage(ad: MarketplaceAd | null | undefined, fallback = ''): string {
    if (!ad) return fallback;
    return ad.image_desktop || ad.image || ad.image_mobile || fallback;
  }

  mobileImage(ad: MarketplaceAd | null | undefined, fallback = ''): string {
    if (!ad) return fallback;
    return ad.image_mobile || ad.image || ad.image_desktop || fallback;
  }

  brandLogo(ad: MarketplaceAd | null | undefined): string {
    if (!ad) return '';
    return ad.logo || ad.shop?.logo || '';
  }

  shopName(ad: MarketplaceAd | null | undefined): string {
    if (!ad) return '';
    return ad.shop?.name || ad.shop?.business_name || '';
  }

  offerText(ad: MarketplaceAd | null | undefined): string {
    if (!ad) return '';
    return ad.offer || ad.discount || '';
  }

  /** Prefer custom ad image, then product thumbnail. */
  productCardImage(ad: MarketplaceAd | null | undefined): string {
    if (!ad) return '';
    return ad.image || ad.image_desktop || ad.product?.thumbnail || ad.image_mobile || '';
  }

  splitMidBanners(ads: MarketplaceAd[]): { left: MarketplaceAd[]; right: MarketplaceAd[] } {
    const left: MarketplaceAd[] = [];
    const right: MarketplaceAd[] = [];
    const unpositioned: MarketplaceAd[] = [];

    ads.forEach((ad) => {
      const position = String(ad.position || '').trim().toLowerCase();
      if (position === 'left') left.push(ad);
      else if (position === 'right') right.push(ad);
      else unpositioned.push(ad);
    });

    unpositioned.forEach((ad) => {
      if (!left.length) left.push(ad);
      else right.push(ad);
    });

    return { left, right };
  }

  /** Order side deals as top then bottom; unpositioned keep API order in the middle. */
  sortSideDeals(ads: MarketplaceAd[]): MarketplaceAd[] {
    const top: MarketplaceAd[] = [];
    const bottom: MarketplaceAd[] = [];
    const other: MarketplaceAd[] = [];

    ads.forEach((ad) => {
      const position = String(ad.position || '').trim().toLowerCase();
      if (position === 'top') top.push(ad);
      else if (position === 'bottom') bottom.push(ad);
      else other.push(ad);
    });

    return [...top, ...other, ...bottom];
  }

  /**
   * Default navigation: product page → shop page → shop_link.
   * Use {@link openShopLink} for banner/promo surfaces that must follow shop_link.
   */
  openAd(ad: MarketplaceAd | null | undefined, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!ad) return;

    const productId = ad.product?.id;
    const productSlug = ad.product?.slug;
    if (productId || productSlug) {
      const linkInfo = buildProductCommands({
        id: productId,
        slug: productSlug,
        store_id: ad.shop?.id || ad.shop_id,
      });
      this.router.navigate(linkInfo.commands, { queryParams: linkInfo.queryParams });
      return;
    }

    const shopId = ad.shop?.id || ad.shop_id;
    if (shopId) {
      this.shopService.navigateToShop(shopId);
      return;
    }

    this.openShopLink(ad);
  }

  /** Header / listing / mid-banner / profile-product: click → shop_link. */
  openShopLink(ad: MarketplaceAd | null | undefined, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!ad) return;

    const link = String(ad.shop_link || '').trim();
    if (link) {
      this.openLink(link);
      return;
    }

    const shopId = ad.shop?.id || ad.shop_id;
    if (shopId) {
      this.shopService.navigateToShop(shopId);
    }
  }

  /** Brand partners: click → shop page from shop.id. */
  openShop(ad: MarketplaceAd | null | undefined, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!ad) return;

    const shopId = ad.shop?.id || ad.shop_id;
    if (shopId) {
      this.shopService.navigateToShop(shopId);
      return;
    }

    this.openShopLink(ad);
  }

  openLink(link: string): void {
    const href = String(link || '').trim();
    if (!href) return;

    if (/^https?:\/\//i.test(href)) {
      if (typeof window !== 'undefined') {
        window.open(href, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Admin often stores "/shop/{id}" but this app's route is /shop-details?store_id=
    const shopMatch = href.match(/^\/shop\/([^/?#]+)\/?$/i);
    if (shopMatch?.[1]) {
      this.shopService.navigateToShop(shopMatch[1]);
      return;
    }

    if (href.startsWith('/')) {
      this.router.navigateByUrl(href);
    }
  }

  private fillEmptyHomeSlots(home: MarketplaceHomeAds): Observable<MarketplaceHomeAds> {
    const slots: (keyof MarketplaceHomeAds)[] = [
      'home_hero',
      'home_side_deals',
      'home_new_arrival',
      'home_mid_banner',
      'brand_partners',
    ];
    const missing = slots.filter((slot) => !home[slot].length);
    if (!missing.length) return of(home);

    return forkJoin(
      missing.map((slot) =>
        this.getAdsBySlot(slot).pipe(catchError(() => of([] as MarketplaceAd[])))
      )
    ).pipe(
      map((lists) => {
        const next = { ...home };
        missing.forEach((slot, index) => {
          if (lists[index].length) next[slot] = lists[index];
        });
        return next;
      })
    );
  }

  private enrichHomeAdsShops(home: MarketplaceHomeAds): Observable<MarketplaceHomeAds> {
    return forkJoin({
      home_hero: this.enrichAdListShops(home.home_hero),
      home_side_deals: this.enrichAdListShops(home.home_side_deals),
      home_new_arrival: this.enrichAdListShops(home.home_new_arrival),
      home_mid_banner: this.enrichAdListShops(home.home_mid_banner),
      brand_partners: this.enrichAdListShops(home.brand_partners),
    });
  }

  private enrichAdListShops(ads: MarketplaceAd[]): Observable<MarketplaceAd[]> {
    if (!ads.length) return of(ads);
    return forkJoin(ads.map((ad) => this.enrichAdShop(ad)));
  }

  private enrichAdShop(ad: MarketplaceAd): Observable<MarketplaceAd> {
    const shopId = ad.shop?.id || '';
    if (!shopId) return of(ad);
    if (ad.shop?.name && ad.shop.focused_categories.length) return of(ad);

    return this.resolveStoreDetails(shopId).pipe(
      map((store) => {
        if (!store) return ad;
        const categories = this.extractStoreCategories(store);
        const fullName = String(store.store_name || store.name || '').trim();
        const shortName = fullName.includes(' - ')
          ? fullName.split(' - ')[0].trim()
          : fullName;
        return {
          ...ad,
          shop: {
            id: String(store.store_id || shopId),
            name: ad.shop?.name || shortName || fullName,
            business_name: ad.shop?.business_name || fullName,
            logo: ad.shop?.logo || '',
            location:
              ad.shop?.location || String(store.store_location || store.location || ''),
            focused_categories: ad.shop?.focused_categories.length
              ? ad.shop.focused_categories
              : categories,
          },
        };
      }),
      catchError(() => of(ad))
    );
  }

  private resolveStoreDetails(shopOrCompanyId: string): Observable<any> {
    const id = String(shopOrCompanyId || '').trim();
    if (!id) return of(null);

    const cached = this.storeDetails$.get(id);
    if (cached) return cached;

    const request$ = this.fetchStoreByStoreId(id).pipe(
      switchMap((store) => {
        if (store) return of(store);
        return this.resolveStoreIdFromCompany(id).pipe(
          switchMap((storeId) => (storeId ? this.fetchStoreByStoreId(storeId) : of(null)))
        );
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.storeDetails$.set(id, request$);
    return request$;
  }

  private fetchStoreByStoreId(storeId: string): Observable<any> {
    return this.api.getStoreByStoreId(storeId).pipe(
      map((res) => {
        const data = extractApiData(res) ?? res;
        if (!data || typeof data !== 'object') return null;
        if (res?.success === false || res?.Success === false) return null;
        if (!data.store_id && !data.store_name && !data.name) return null;
        return data;
      }),
      catchError(() => of(null))
    );
  }

  private resolveStoreIdFromCompany(companyId: string): Observable<string> {
    const cached = this.companyStoreIdCache.get(companyId);
    if (cached) return of(cached);

    return this.api.getMarketplaceProducts().pipe(
      map((res) => {
        const list = extractApiList(res);
        const hits = list.filter(
          (item) => String(item?.company_id || '').trim() === companyId
        );
        if (!hits.length) return '';

        const counts = new Map<string, number>();
        hits.forEach((item) => {
          const storeId = String(item?.store_id || '').trim();
          if (!storeId) return;
          counts.set(storeId, (counts.get(storeId) || 0) + 1);
        });

        let bestId = '';
        let bestCount = -1;
        counts.forEach((count, storeId) => {
          if (count > bestCount) {
            bestCount = count;
            bestId = storeId;
          }
        });
        if (bestId) this.companyStoreIdCache.set(companyId, bestId);
        return bestId;
      }),
      catchError(() => of(''))
    );
  }

  private extractStoreCategories(store: any): string[] {
    const rows = store?.st_StoreCategories ?? store?.st_store_categories ?? [];
    if (!Array.isArray(rows)) return [];

    const names: string[] = [];
    rows.forEach((row: any) => {
      const selected = String(row?.is_selected ?? 'T').trim().toUpperCase();
      if (selected === 'F' || selected === 'FALSE' || selected === '0' || selected === 'N') {
        return;
      }
      const views =
        row?.im_ProductCategories_view ??
        row?.im_ProductCategories ??
        row?.im_product_categories_view ??
        [];
      if (Array.isArray(views) && views.length) {
        views.forEach((view: any) => {
          const name = String(view?.category_name || view?.categoryName || '').trim();
          if (name) names.push(name);
        });
        return;
      }
      const fallback = String(row?.category_name || row?.categoryName || '').trim();
      if (fallback) names.push(fallback);
    });

    return [...new Set(names)];
  }

  private extractSlotPayload(response: any, slot?: string): any[] {
    const data = extractApiData(response) ?? response;
    const fromValue = this.asAdArray(data);
    if (fromValue.length) return fromValue;

    if (data && typeof data === 'object') {
      const keys = [
        slot,
        'ads',
        'Ads',
        'items',
        'Items',
        'result',
        'Result',
      ].filter(Boolean) as string[];
      for (const key of keys) {
        const list = this.asAdArray((data as any)[key]);
        if (list.length) return list;
      }

      const wanted = new Set(keys.map((key) => this.normalizeKey(key)));
      for (const [key, value] of Object.entries(data)) {
        if (!wanted.has(this.normalizeKey(key))) continue;
        const list = this.asAdArray(value);
        if (list.length) return list;
      }
    }

    return extractApiList(response);
  }

  private mapHomeAds(raw: any): MarketplaceHomeAds {
    if (!raw || typeof raw !== 'object') return EMPTY_HOME_ADS;

    if (Array.isArray(raw)) {
      return {
        home_hero: this.adsForSlot(raw, 'home_hero'),
        home_side_deals: this.adsForSlot(raw, 'home_side_deals'),
        home_new_arrival: this.adsForSlot(raw, 'home_new_arrival'),
        home_mid_banner: this.adsForSlot(raw, 'home_mid_banner'),
        brand_partners: this.adsForSlot(raw, 'brand_partners'),
      };
    }

    return {
      home_hero: this.pickAdList(raw, 'home_hero', 'homeHero', 'hero', 'heroes'),
      home_side_deals: this.pickAdList(
        raw,
        'home_side_deals',
        'homeSideDeals',
        'side_deals',
        'sideDeals'
      ),
      home_new_arrival: this.pickAdList(
        raw,
        'home_new_arrival',
        'homeNewArrival',
        'new_arrival',
        'newArrivals'
      ),
      home_mid_banner: this.pickAdList(
        raw,
        'home_mid_banner',
        'homeMidBanner',
        'mid_banner',
        'midBanners'
      ),
      brand_partners: this.pickAdList(
        raw,
        'brand_partners',
        'brandPartners',
        'partners'
      ),
    };
  }

  private pickAdList(raw: any, slot: MarketplaceAdSlot, ...aliases: string[]): MarketplaceAd[] {
    const keys = [slot, ...aliases];
    for (const key of keys) {
      const list = this.asAdArray(raw?.[key]);
      if (list.length) return this.mapAdList(list);
    }

    const wanted = new Set(keys.map((key) => this.normalizeKey(key)));
    for (const [key, value] of Object.entries(raw || {})) {
      if (!wanted.has(this.normalizeKey(key))) continue;
      const list = this.asAdArray(value);
      if (list.length) return this.mapAdList(list);
    }

    if (raw?.data && raw.data !== raw) {
      return this.pickAdList(raw.data, slot, ...aliases);
    }

    return [];
  }

  private adsForSlot(items: any[], slot: MarketplaceAdSlot): MarketplaceAd[] {
    return this.mapAdList(
      items.filter((item) => this.normalizeKey(item?.slot) === this.normalizeKey(slot))
    );
  }

  private asAdArray(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const looksLikeAd =
        value.ad_id ||
        value.adId ||
        value.id ||
        value.slot ||
        value.image ||
        value.image_desktop ||
        value.imageDesktop ||
        value.image_url ||
        value.imageUrl ||
        value.logo;
      if (looksLikeAd) return [value];
    }
    return [];
  }

  private normalizeKey(key: string | null | undefined): string {
    return String(key || '')
      .replace(/[_-]/g, '')
      .toLowerCase();
  }

  private mapAdList(raw: any): MarketplaceAd[] {
    const items = this.asAdArray(raw);
    if (!items.length) return [];
    return items.map((item) => this.mapAd(item)).filter((ad) => this.keepAd(ad));
  }

  private keepAd(ad: MarketplaceAd): boolean {
    if (ad.is_active === undefined || ad.is_active === null || ad.is_active === '') {
      return true;
    }
    const flag = String(ad.is_active).trim().toLowerCase();
    return flag === 'true' || flag === 't' || flag === '1' || flag === 'yes' || flag === 'y';
  }

  private mapAd(raw: any): MarketplaceAd {
    const shopRaw = raw?.shop ?? raw?.Shop ?? null;
    const productRaw = raw?.product ?? raw?.Product ?? null;
    const shopId = this.readString(raw, 'shop_id', 'shopId', 'store_id', 'storeId');
    const rootShopName = this.readString(
      raw,
      'shop_name',
      'shopName',
      'store_name',
      'storeName'
    );
    const rootCategories = this.readCategoryList(raw);

    let shop = shopRaw ? this.mapShop(shopRaw) : null;
    if (!shop && (shopId || rootShopName || rootCategories.length)) {
      shop = {
        id: shopId,
        name: rootShopName,
        business_name: '',
        logo: '',
        location: '',
        focused_categories: rootCategories,
      };
    } else if (shop) {
      shop = {
        ...shop,
        id: shop.id || shopId,
        name: shop.name || rootShopName,
        focused_categories: shop.focused_categories.length
          ? shop.focused_categories
          : rootCategories,
      };
    }

    const sortOrder = Number(raw?.sort_order ?? raw?.sortOrder);
    return {
      id: this.readString(raw, 'ad_id', 'adId', 'id'),
      slot: this.readString(raw, 'slot'),
      position: this.readString(raw, 'position'),
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      shop_id: shopId,
      product_id: this.readString(raw, 'product_id', 'productId'),
      image: this.readString(raw, 'image', 'image_url', 'imageUrl', 'banner_image', 'bannerImage'),
      image_desktop: this.readString(
        raw,
        'image_desktop',
        'imageDesktop',
        'desktop_image',
        'desktopImage'
      ),
      image_mobile: this.readString(
        raw,
        'image_mobile',
        'imageMobile',
        'mobile_image',
        'mobileImage'
      ),
      logo: this.readString(raw, 'logo', 'logo_url', 'logoUrl'),
      shop_link: this.readString(raw, 'shop_link', 'shopLink', 'link', 'url', 'href'),
      offer: this.readString(raw, 'offer'),
      discount: this.readString(raw, 'discount'),
      title: this.readString(raw, 'title'),
      description: this.readString(raw, 'description'),
      button_text: this.readString(raw, 'button_text', 'buttonText', 'cta', 'cta_text'),
      shop,
      product: productRaw ? this.mapProduct(productRaw) : null,
      is_active: raw?.is_active ?? raw?.isActive,
    };
  }

  private mapShop(raw: any): MarketplaceAdShop {
    const categories = this.readCategoryList(raw);
    return {
      id: this.readString(raw, 'id', 'store_id', 'storeId'),
      name: this.readString(raw, 'name', 'shop_name', 'shopName'),
      business_name: this.readString(raw, 'business_name', 'businessName'),
      logo: this.readString(raw, 'logo'),
      location: this.readString(raw, 'location'),
      focused_categories: categories,
    };
  }

  private readCategoryList(raw: any): string[] {
    if (!raw || typeof raw !== 'object') return [];
    const value =
      raw.focused_categories ??
      raw.focusedCategories ??
      raw.categories ??
      raw.all_categories ??
      raw.allCategories ??
      raw.category_names ??
      raw.categoryNames;
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return value
        .split(/[,•|]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private mapProduct(raw: any): MarketplaceAdProduct {
    const price = Number(raw?.price);
    const rating = Number(raw?.rating);
    return {
      id: this.readString(raw, 'id', 'product_id', 'productId'),
      slug: this.readString(raw, 'slug'),
      name: this.readString(raw, 'name', 'title'),
      thumbnail: this.readString(raw, 'thumbnail', 'image'),
      category: this.readString(raw, 'category'),
      rating: Number.isFinite(rating) ? rating : 0,
      price: Number.isFinite(price) ? price : 0,
      currency_symbol: this.readString(raw, 'currency_symbol', 'currencySymbol') || '$',
    };
  }

  private readString(raw: any, ...keys: string[]): string {
    if (!raw || typeof raw !== 'object') return '';
    const expanded = keys.flatMap((key) => [
      key,
      key.charAt(0).toUpperCase() + key.slice(1),
    ]);
    for (const key of expanded) {
      const value = raw[key];
      if (value == null || value === '') continue;
      const text = String(value).trim();
      if (text && text.toLowerCase() !== 'null') return text;
    }
    return '';
  }
}
