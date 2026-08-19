import { ChangeDetectorRef, Component, ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { ProductCardSkeleton } from '../../../../shared/components/product-card-skeleton/product-card-skeleton';
import { resolveStoreRegionFromProduct } from '../../../../core/utils/marketplace-shop.util';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';
import { buildProductCommands } from '../../../../core/utils/product-url.util';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface HomeProductCard {
  id: string;
  /** SEO slug from im_Products.slug */
  slug?: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  image: string;
  rating?: number;
  store_id?: string;
  store_name?: string;
  shop_atoll?: string;
  shop_city?: string;
  shop_location?: string;
  store_currency_code?: string;
  store_currency_symbol?: string;
  display_currency?: string;
  original_currency?: string;
  original_price_hint?: string;
  category_id?: string;
  sub_category_id?: string;
  sub_sub_category_id?: string;
  created_at?: string;
  featured_item?: string;
  /** True when product came from the user's chosen location (not Male filler). */
  fromSelectedLocation?: boolean;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, Header, Footer, ShopNameLink, ProductCardSkeleton],
  templateUrl: './home.html',
  styleUrl: './home.css',
  host: { class: 'block max-w-full overflow-x-hidden' },
})
export class Home implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('recentlyViewedCarousel') recentlyViewedCarousel?: ElementRef<HTMLElement>;
  @ViewChild('interestCarousel') interestCarousel?: ElementRef<HTMLElement>;
  @ViewChild('brandCarousel') brandCarousel?: ElementRef<HTMLElement>;

  categoryTree: any[] = [];
  allCategoryTree: any[] = []; // Full category tree
  /** Duplicated list for seamless desktop marquee */
  interestMarqueeCategories: any[] = [];
  activeChildMap: Map<string, any> = new Map(); // Track active child for each parent category
  mobileTopCategoryFallback: Array<{ category_name: string }> = [
    { category_name: 'Books & Stationery' },
    { category_name: 'Sports & Outdoors' },
    { category_name: 'Travel & Luggage' },
    { category_name: 'Home Products' },
    { category_name: 'Electronics' },
  ];
  activeMobileSecondCategoryId: string = 'all';
  readonly mobileAllCategoryOption = { category_id: 'all', category_name: 'All' };
  readonly brandPartners: Array<{ name: string; subtitle?: string; style?: 'light' | 'semibold' | 'bold' }> = [
    { name: 'Walmart', subtitle: 'eCommerce', style: 'bold' },
    { name: 'RODEM', subtitle: 'SMART SANITARY', style: 'semibold' },
    { name: 'fabric', style: 'light' },
    { name: 'SUDO', subtitle: 'E-COMMERCE', style: 'bold' },
    { name: 'ctaecom', subtitle: 'e-commerce', style: 'semibold' },
    { name: 'LEAD', subtitle: 'E-COMMERCE', style: 'bold' },
    { name: 'GLOBAL', subtitle: 'BRAND', style: 'bold' },
    { name: 'Great Deals', subtitle: 'E-Commerce', style: 'semibold' },
  ];
  /** Duplicated for seamless brand marquee */
  brandMarqueeItems: Array<{ name: string; subtitle?: string; style?: 'light' | 'semibold' | 'bold' }> = [];
  private readonly categoryChipImages: Record<string, string> = {
    electronics: '/Categories1.jpg',
    phone: '/mobile.jpg',
    mobile: '/mobile2.jpg',
    fashion: '/shirt.jpg',
    clothing: '/shirt2.jpg',
    apparel: '/shirts.jpg',
    home: '/Categories3.jpg',
    furniture: '/Categories4.jpg',
    beauty: '/Categories5.jpg',
    sport: '/shoe.jpg',
    shoes: '/shoe2.jpg',
    watch: '/air-pod.jpg',
    jewelry: '/glass.jpg',
    grocery: '/Categories6.jpg',
    food: '/Categories7.jpg',
    kitchen: '/Categories8.jpg',
    book: '/Categories9.jpg',
    baby: '/Categories10.jpg',
    toy: '/Categories11.jpg',
    automotive: '/Categories12.jpg',
  };
  heroAds: Array<{
    image: string;
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    discount?: string;
    queryParams?: Record<string, string>;
  }> = [
    {
      image: '/The_Path_of_The_Ferocious__Starter_Pack_-removebg-preview.png',
      badge: 'Home & Living',
      title: 'Elevate Your Space',
      subtitle: 'Premium furniture & decor — crafted for modern living',
      cta: 'Shop Furniture',
      discount: '30% OFF',
      queryParams: { mode: 'browse', type: 'home' },
    },
    {
      image: '/New_colour_drop__Series_1_Triple_Taupe_Suede___Instagram-removebg-preview.png',
      badge: 'Mega Sale',
      title: 'Deals You’ll Love',
      subtitle: 'Save big across electronics, fashion, and more',
      cta: 'View All Deals',
      discount: 'UP TO 50%',
      queryParams: { mode: 'browse' },
    },
    {
      image: '/iphone_18_pro_color-removebg-preview.png',
      badge: 'Electronics',
      title: 'Next-Gen Tech',
      subtitle: 'Phones, laptops & gadgets at unbeatable prices',
      cta: 'Shop Electronics',
      discount: 'NEW IN',
      queryParams: { mode: 'browse', type: 'electronics' },
    },
    {
      image: '/adidas_Sportswear_TIRO_SET_-_Tracksuit_-_dark_blue-removebg-preview.png',
      badge: 'Fashion',
      title: 'Style That Stands Out',
      subtitle: 'Fresh arrivals in clothing & accessories',
      cta: 'Shop Fashion',
      discount: '25% OFF',
      queryParams: { mode: 'browse', type: 'fashion' },
    },
    {
      image: '/Samsung_Galaxy_S26_Ultra-removebg-preview.png',
      badge: 'Electronics',
      title: 'Next-Gen Tech',
      subtitle: 'Phones, laptops & gadgets at unbeatable prices',
      cta: 'Shop Electronics',
      discount: 'NEW IN',
      queryParams: { mode: 'browse', type: 'electronics' },
    },
    {
      image: '/Ray-Ban_RB4165_Justin_Sunglasses_+_Vision_Group_Accessories_Bundle-removebg-preview.png',
      badge: 'Fashion',
      title: 'Style That Stands Out',
      subtitle: 'Fresh arrivals in clothing & accessories',
      cta: 'Shop Fashion',
      discount: '25% OFF',
      queryParams: { mode: 'browse', type: 'fashion' },
    },
  ];
  activeHeroImageIndex: number = 0;
  nextHeroImageIndex: number = 1;
  isHeroImageTransitioning: boolean = false;
  heroSlideDirection: 'next' | 'prev' = 'next';
  readonly heroTransitionMs = 900;
  private heroImageIntervalId: ReturnType<typeof setInterval> | null = null;
  private heroImageTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private interestMarqueeRaf: number | null = null;
  private interestMarqueePaused = false;
  private interestMarqueeHovered = false;
  private interestMarqueeResumeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly interestMarqueeSpeed = 0.55;
  private brandMarqueeRaf: number | null = null;
  private brandMarqueePaused = false;
  private brandMarqueeHovered = false;
  private brandMarqueeResumeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly brandMarqueeSpeed = 0.55;
  private dragScrollState: {
    el: HTMLElement;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null = null;
  private suppressNextClick = false;
  private readonly onMarqueeResize = () => {
    this.syncInterestMarquee();
    this.syncBrandMarquee();
  };
  private readonly recentlyViewedStorageKey = 'recently_viewed_products';
  private readonly recentSearchesStorageKey = 'recent_searches';
  private readonly featuredRotationStorageKey = 'featured_products_rotation_offset';
  private readonly featuredProductsPageSize = 10;
  /** Locked for this page visit so currency/region reloads don't skip a batch. */
  private featuredRotationStart: number | null = null;
  private allCategoriesFlat: any[] = [];
  private allMarketplaceCards: HomeProductCard[] = [];
  private readonly regionUpdatedHandler = () => this.loadMarketplaceProducts();
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.loadMarketplaceProducts(detail?.currency_code);
  };

  newArrivals: HomeProductCard[] = [];
  featuredProducts: HomeProductCard[] = [];
  discoverProductsForYou: HomeProductCard[] = [];
  recentlyViewed: HomeProductCard[] = [];
  isProductsLoading = true;
  readonly productSkeletonSlots = [1, 2, 3, 4, 5];

  constructor(
    private router: Router,
    private api: BackendapiServices,
    private regionService: RegionService,
    private shopService: MarketplaceShopService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Duplicate enough times so the strip always overflows and loops like categories.
    this.brandMarqueeItems = [
      ...this.brandPartners,
      ...this.brandPartners,
      ...this.brandPartners,
      ...this.brandPartners,
    ];
    this.loadCategory();
    this.loadMarketplaceProducts();
    this.startHeroImageRotation();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
      window.addEventListener('currency-updated', this.currencyUpdatedHandler);
      window.addEventListener('resize', this.onMarqueeResize);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.syncBrandMarquee(), 0);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
      window.removeEventListener('currency-updated', this.currencyUpdatedHandler);
      window.removeEventListener('resize', this.onMarqueeResize);
    }
    this.stopInterestMarquee();
    this.stopBrandMarquee();
    if (this.heroImageIntervalId) {
      clearInterval(this.heroImageIntervalId);
      this.heroImageIntervalId = null;
    }
    if (this.heroImageTransitionTimeoutId) {
      clearTimeout(this.heroImageTransitionTimeoutId);
      this.heroImageTransitionTimeoutId = null;
    }
  }


  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      const allCategories = res.data || [];
      this.allCategoriesFlat = Array.isArray(allCategories) ? allCategories : [];

      // Parent categories (API may return null/undefined/empty parent_id for top-level nodes)
      const parents = allCategories.filter((cat: any) => {
        const parentId = cat?.parent_id;
        return parentId == null || String(parentId).trim() === '';
      });

      // Build recursive tree for all categories
      const allCategoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, allCategories));

      // Store full tree for interest carousel and mobile chips
      this.allCategoryTree = allCategoryTree;
      this.interestMarqueeCategories = [...allCategoryTree, ...allCategoryTree];

      // Limit to 9 categories for home page
      this.categoryTree = allCategoryTree.slice(0, 9);
      this.refreshProductSections();
      setTimeout(() => this.syncInterestMarquee(), 0);
      this.cdr.markForCheck();
    });
  }

  private loadMarketplaceProducts(currencyOverride?: string): void {
    this.isProductsLoading = true;
    this.cdr.markForCheck();
    const generation = this.currencyService.fetchGeneration;
    const selectedParams = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );
    const defaultParams = this.currencyService.enrichProductParams(
      this.regionService.getDefaultProductRequestParams(),
      currencyOverride
    );
    const alreadyDefault = this.regionService.isDefaultLocationSelected();

    this.api
      .getMarketplaceProducts(selectedParams)
      .pipe(
        catchError(() => of({ data: [] })),
        switchMap((selectedRes: any) => {
          const selectedRaw = this.api.extractProductsFromResponse(selectedRes);
          const selectedCards = selectedRaw.map((product: any) =>
            this.mapApiProductToCard(product, true)
          );

          if (alreadyDefault) {
            return of(selectedCards);
          }

          return this.api.getMarketplaceProducts(defaultParams).pipe(
            catchError(() => of({ data: [] })),
            map((defaultRes: any) => {
              const defaultRaw = this.api.extractProductsFromResponse(defaultRes);
              const defaultCards = defaultRaw.map((product: any) =>
                this.mapApiProductToCard(product, false)
              );
              return this.mergeLocationThenDefault(selectedCards, defaultCards);
            })
          );
        })
      )
      .subscribe({
        next: (cards) => {
          if (!this.currencyService.isCurrentGeneration(generation)) return;
          this.allMarketplaceCards = cards;
          this.refreshProductSections();
          this.isProductsLoading = false;
          this.cdr.markForCheck();

          this.shopService.enrichWithShopNames(cards).subscribe({
            next: (enriched) => {
              if (!this.currencyService.isCurrentGeneration(generation)) return;
              this.allMarketplaceCards = enriched;
              this.refreshProductSections();
              this.cdr.markForCheck();
            },
            error: () => {
              /* cards already shown */
            },
          });
        },
        error: () => {
          if (!this.currencyService.isCurrentGeneration(generation)) return;
          this.allMarketplaceCards = [];
          this.newArrivals = [];
          this.featuredProducts = [];
          this.discoverProductsForYou = [];
          this.buildRecentlyViewed();
          this.isProductsLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Chosen-location products first, then Male fillers (no duplicates). */
  private mergeLocationThenDefault(
    selected: HomeProductCard[],
    defaults: HomeProductCard[]
  ): HomeProductCard[] {
    const seen = new Set<string>();
    const merged: HomeProductCard[] = [];

    selected.forEach((card) => {
      const id = String(card.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push({ ...card, fromSelectedLocation: true });
    });

    defaults.forEach((card) => {
      const id = String(card.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push({ ...card, fromSelectedLocation: false });
    });

    return merged;
  }

  private extractProductList(res: any): any[] {
    return this.api.extractProductsFromResponse(res);
  }

  private mapApiProductToCard(
    product: any,
    fromSelectedLocation = true
  ): HomeProductCard {
    const variant = product?.im_ProductVariants?.[0];
    const images = Array.isArray(variant?.im_ProductImages) ? variant.im_ProductImages : [];
    const productImages = Array.isArray(product?.im_ProductImages) ? product.im_ProductImages : [];
    const allImages = [...images, ...productImages];
    const imageUrl =
      product?.thumbnail_url ||
      allImages.find((img: any) => img?.is_primary === 'T')?.image_url ||
      allImages[0]?.image_url ||
      '/mobile.jpg';
    const basePrice = Number(variant?.base_price ?? product?.fixed_price ?? 0);
    const display = resolveVariantDisplayPrice(variant, product);
    const categoryId = this.normalizeId(product?.category_id);
    const subCategoryId = this.normalizeId(product?.sub_category_id);
    const subSubCategoryId = this.normalizeId(product?.sub_sub_category_id);
    const { atoll, city } = resolveStoreRegionFromProduct(product);
    const apiRating = Number(product?.rating ?? product?.average_rating ?? 0);
    const rating = apiRating > 0 ? apiRating : Math.round((4 + Math.random()) * 10) / 10;

    return {
      id: this.normalizeId(product?.product_id ?? product?.id),
      slug: String(product?.slug || '').trim() || undefined,
      name: product?.title || 'Untitled Product',
      category: this.resolveCategoryName(categoryId, subCategoryId, subSubCategoryId),
      price: display.price,
      originalPrice: display.originalPrice,
      image: imageUrl,
      rating,
      store_id: this.resolveStoreId(product, variant),
      shop_atoll: atoll,
      shop_city: city,
      store_currency_code: display.display_currency,
      store_currency_symbol: display.display_symbol,
      display_currency: display.display_currency,
      original_currency: display.original_currency,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      sub_sub_category_id: subSubCategoryId,
      created_at: this.resolveProductDate(product),
      featured_item: String(product?.featured_item ?? '').trim(),
      fromSelectedLocation,
    };
  }

  private resolveProductDate(product: any): string {
    return String(
      product?.created_at ??
        product?.CreatedAt ??
        product?.createdAt ??
        product?.updated_at ??
        product?.UpdatedAt ??
        product?.updatedAt ??
        product?.create_date ??
        product?.date_created ??
        ''
    ).trim();
  }

  private refreshProductSections(): void {
    if (this.allMarketplaceCards.length && this.allCategoriesFlat.length) {
      this.allMarketplaceCards = this.allMarketplaceCards.map((product) => ({
        ...product,
        category: this.resolveCategoryName(
          product.category_id || '',
          product.sub_category_id || '',
          product.sub_sub_category_id || ''
        ),
      }));
    }
    this.buildNewArrivals();
    this.buildFeaturedProducts();
    this.buildDiscoverProductsForYou();
    this.buildRecentlyViewed();
  }

  /**
   * Home sections: chosen-location products first, then Male fillers.
   * Sorting (e.g. newest) stays within that priority.
   */
  private getHomeDisplayCards(): HomeProductCard[] {
    return [...this.allMarketplaceCards];
  }

  private prioritizeSelectedLocation(cards: HomeProductCard[]): HomeProductCard[] {
    const primary = cards.filter((p) => this.isFromChosenLocation(p));
    const fillers = cards.filter((p) => !this.isFromChosenLocation(p));
    if (!primary.length && !fillers.length) return [...cards];
    return [...primary, ...fillers];
  }

  private buildNewArrivals(): void {
    const cards = this.getHomeDisplayCards();
    const fromLocation = cards
      .filter((p) => this.isFromChosenLocation(p))
      .sort((a, b) => this.getProductTimestamp(b) - this.getProductTimestamp(a));
    const fromOther = cards
      .filter((p) => !this.isFromChosenLocation(p))
      .sort((a, b) => this.getProductTimestamp(b) - this.getProductTimestamp(a));

    this.newArrivals = [...fromLocation, ...fromOther].slice(0, 8);
  }

  /** True when the product belongs to the user's chosen atoll/city. */
  private isFromChosenLocation(product: HomeProductCard): boolean {
    if (this.regionService.isDefaultLocationSelected()) {
      return true;
    }

    const { regionName, city } = this.regionService.getEffectiveSelection();
    const atoll = String(regionName || '').trim().toLowerCase();
    const cityName = String(city || '').trim().toLowerCase();
    const productAtoll = String(product.shop_atoll || '').trim().toLowerCase();
    const productCity = String(product.shop_city || '').trim().toLowerCase();

    if (productAtoll || productCity) {
      if (atoll && productAtoll && productAtoll !== atoll) return false;
      if (cityName && productCity && productCity !== cityName) return false;
      // Prefer shop metadata match for chosen location.
      if (cityName && productCity) return productCity === cityName;
      if (atoll && productAtoll) return productAtoll === atoll;
      return true;
    }

    return product.fromSelectedLocation === true;
  }

  private buildFeaturedProducts(): void {
    const featured = this.getFeaturedProductsPool();
    const pageSize = this.featuredProductsPageSize;

    if (!featured.length) {
      this.featuredProducts = [];
      return;
    }

    if (featured.length <= pageSize) {
      this.featuredProducts = featured;
      return;
    }

    if (this.featuredRotationStart === null) {
      const rawOffset = this.readFeaturedRotationOffset();
      const start = ((rawOffset % featured.length) + featured.length) % featured.length;
      this.featuredRotationStart = start;
      this.writeFeaturedRotationOffset((start + pageSize) % featured.length);
    }

    this.featuredProducts = this.takeCircularSlice(
      featured,
      this.featuredRotationStart,
      pageSize
    );
  }

  /** Stable featured pool: chosen location first, then others, sorted by id within each group. */
  private getFeaturedProductsPool(): HomeProductCard[] {
    const featured = this.getHomeDisplayCards().filter((product) =>
      this.isFeaturedProduct(product)
    );
    const byId = (a: HomeProductCard, b: HomeProductCard) =>
      String(a.id || '').localeCompare(String(b.id || ''));
    const primary = featured.filter((p) => this.isFromChosenLocation(p)).sort(byId);
    const fillers = featured.filter((p) => !this.isFromChosenLocation(p)).sort(byId);
    return [...primary, ...fillers];
  }

  private takeCircularSlice<T>(items: T[], start: number, count: number): T[] {
    if (!items.length || count <= 0) return [];
    const size = Math.min(count, items.length);
    const result: T[] = [];
    for (let i = 0; i < size; i++) {
      result.push(items[(start + i) % items.length]);
    }
    return result;
  }

  private readFeaturedRotationOffset(): number {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(this.featuredRotationStorageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }

  private writeFeaturedRotationOffset(offset: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.featuredRotationStorageKey, String(Math.max(0, Math.floor(offset))));
  }

  private buildDiscoverProductsForYou(): void {
    const scopedCards = this.getHomeDisplayCards();
    const searchTerm = this.getLatestSearchTerm();
    if (!searchTerm || !scopedCards.length) {
      this.discoverProductsForYou = this.prioritizeSelectedLocation(scopedCards).slice(0, 5);
      return;
    }

    const term = searchTerm.toLowerCase();
    const directMatches = scopedCards.filter((product) =>
      this.productMatchesSearchTerm(product, term)
    );

    const relatedCategoryIds = new Set<string>();
    directMatches.forEach((product) => {
      [product.category_id, product.sub_category_id, product.sub_sub_category_id]
        .filter((id) => !!id)
        .forEach((id) => relatedCategoryIds.add(id!));
    });

    const relatedMatches = scopedCards.filter((product) => {
      if (directMatches.includes(product)) return false;
      return [product.category_id, product.sub_category_id, product.sub_sub_category_id].some(
        (id) => !!id && relatedCategoryIds.has(id!)
      );
    });

    const combined = this.prioritizeSelectedLocation([...directMatches, ...relatedMatches]);
    this.discoverProductsForYou = (combined.length
      ? combined
      : this.prioritizeSelectedLocation(scopedCards)
    ).slice(0, 5);
  }

  private buildRecentlyViewed(): void {
    const stored = this.getStoredRecentlyViewed();
    const resolved: HomeProductCard[] = [];

    stored.forEach((entry: any) => {
      const productId = this.normalizeId(entry?.id ?? entry?.productId);
      if (!productId) return;

      const fromApi = this.allMarketplaceCards.find((p) => p.id === productId);
      if (fromApi) {
        resolved.push(fromApi);
        return;
      }

      if (entry?.name && entry?.image) {
        resolved.push({
          id: productId,
          name: entry.name,
          category: entry.category || 'Product',
          price: Number(entry.price) || 0,
          originalPrice: Number(entry.originalPrice) || 0,
          image: entry.image,
          store_id: entry.store_id ? String(entry.store_id) : undefined,
          store_name: entry.store_name ? String(entry.store_name) : undefined,
          shop_location: entry.shop_location ? String(entry.shop_location) : undefined,
        });
      }
    });

    const limited = resolved.slice(0, 12);
    this.recentlyViewed = limited;
    this.cdr.markForCheck();
    this.shopService.enrichWithShopNames(limited).subscribe({
      next: (enriched) => {
        this.recentlyViewed = enriched;
        this.cdr.markForCheck();
      },
      error: () => {
        /* limited already shown */
      },
    });
  }

  private getLatestSearchTerm(): string {
    if (typeof window === 'undefined') return '';
    const raw = localStorage.getItem(this.recentSearchesStorageKey);
    if (!raw) return '';

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return '';
      return String(parsed[0]?.query || '').trim();
    } catch {
      return '';
    }
  }

  private productMatchesSearchTerm(product: HomeProductCard, term: string): boolean {
    const haystacks = [
      product.name,
      product.category,
      product.category_id,
      product.sub_category_id,
      product.sub_sub_category_id,
    ]
      .map((v) => String(v || '').toLowerCase())
      .filter(Boolean);
    return haystacks.some((text) => text.includes(term));
  }

  private isFeaturedProduct(product: HomeProductCard): boolean {
    const flag = String(product.featured_item || '').trim().toUpperCase();
    return flag === 'T' || flag === 'TRUE' || flag === '1' || flag === 'Y' || flag === 'YES';
  }

  private getProductTimestamp(product: HomeProductCard): number {
    const raw = product.created_at || '';
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private resolveCategoryName(
    categoryId: string,
    subCategoryId: string,
    subSubCategoryId: string
  ): string {
    const ids = [subSubCategoryId, subCategoryId, categoryId].filter(Boolean);
    for (const id of ids) {
      const match = this.allCategoriesFlat.find(
        (cat: any) => this.normalizeId(cat?.category_id ?? cat?.id) === id
      );
      if (match?.category_name || match?.name) {
        return match.category_name || match.name;
      }
    }
    return 'Products';
  }

  private resolveStoreId(product: any, variant: any): string {
    return this.normalizeId(
      product?.store_id ??
        product?.storeId ??
        variant?.store_id ??
        variant?.storeId ??
        variant?.im_StoreVariantInventory?.[0]?.store_id ??
        variant?.im_StoreVariantInventory?.[0]?.storeId
    );
  }

  private normalizeId(value: any): string {
    return value == null ? '' : String(value);
  }

  private getStoredRecentlyViewed(): any[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(this.recentlyViewedStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  onProductClick(product: HomeProductCard): void {
    if (!product?.id && !product?.slug) return;
    if (product.store_id && typeof window !== 'undefined') {
      localStorage.setItem('store_id', product.store_id);
    }
    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  onViewAllCategories() {
    this.router.navigate(['/categories']);
  }

  // Recursive function to build category tree
  buildCategoryTree(parent: any, allCategories: any[]): any {
    const children = allCategories.filter(
      (cat: any) => cat.parent_id === parent.category_id
    );

    return {
      ...parent,
      children: children.map((child: any) => this.buildCategoryTree(child, allCategories)),
    };
  }

  setActiveChild(parentId: string, child: any) {
    this.activeChildMap.set(parentId, child);
  }

  clearActiveChild(parentId: string) {
    this.activeChildMap.delete(parentId);
  }

  getActiveChild(parentId: string): any {
    return this.activeChildMap.get(parentId);
  }

  onCategoryClick(category: any) {
    if (!category?.category_id) {
      return;
    }

    this.router.navigate(['/product-list'], {
      queryParams: {
        categoryId: category.category_id,
        category_id: category.category_id,
        categoryName: category.category_name,
      },
    });
  }

  onInterestCategoryClick(category: any) {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (!category?.category_id) {
      return;
    }

    this.router.navigate(['/product-list'], {
      queryParams: {
        categoryId: category.category_id,
        category_id: category.category_id,
        categoryName: category.category_name,
      },
    });
  }

  getMobileSecondCategories(): any[] {
    const secondLevel = this.collectAllSecondLevelCategories();
    const withProducts = secondLevel.filter((category) =>
      this.categoryHasProducts(category)
    );
    return [this.mobileAllCategoryOption, ...withProducts];
  }

  private collectAllSecondLevelCategories(): any[] {
    const tree = this.allCategoryTree.length ? this.allCategoryTree : this.categoryTree;
    const secondLevel: any[] = [];

    tree.forEach((parent: any) => {
      (parent.children || []).forEach((child: any) => secondLevel.push(child));
    });

    if (secondLevel.length) {
      return secondLevel;
    }

    const rootIds = new Set(
      this.allCategoriesFlat
        .filter((cat: any) => {
          const parentId = cat?.parent_id;
          return parentId == null || String(parentId).trim() === '';
        })
        .map((cat: any) => this.normalizeId(cat.category_id))
    );

    return this.allCategoriesFlat.filter((cat: any) =>
      rootIds.has(this.normalizeId(cat.parent_id))
    );
  }

  private categoryHasProducts(category: any): boolean {
    if (!this.allMarketplaceCards.length) {
      return false;
    }

    const categoryIds = new Set(this.getAllCategoryIds(category));
    return this.allMarketplaceCards.some((product) =>
      this.productMatchesCategoryIds(product, categoryIds)
    );
  }

  private getAllCategoryIds(category: any): string[] {
    const selectedId = this.normalizeId(category?.category_id);
    if (!selectedId) {
      return [];
    }

    const ids = new Set<string>();

    const addDescendants = (categoryId: string) => {
      if (!categoryId || ids.has(categoryId)) {
        return;
      }
      ids.add(categoryId);
      const children = this.allCategoriesFlat.filter(
        (cat: any) => this.normalizeId(cat.parent_id) === categoryId
      );
      children.forEach((child: any) =>
        addDescendants(this.normalizeId(child.category_id))
      );
    };

    const addAncestors = (categoryId: string) => {
      if (!categoryId) {
        return;
      }
      const current = this.allCategoriesFlat.find(
        (cat: any) => this.normalizeId(cat.category_id) === categoryId
      );
      const parentId = this.normalizeId(current?.parent_id);
      if (!parentId || ids.has(parentId)) {
        return;
      }
      ids.add(parentId);
      addAncestors(parentId);
    };

    addDescendants(selectedId);
    addAncestors(selectedId);

    return Array.from(ids);
  }

  private productMatchesCategoryIds(
    product: HomeProductCard,
    categoryIds: Set<string>
  ): boolean {
    const productCategoryIds = [
      product.category_id,
      product.sub_category_id,
      product.sub_sub_category_id,
    ]
      .filter(Boolean)
      .map((id) => this.normalizeId(id));

    return productCategoryIds.some((id) => categoryIds.has(id));
  }

  onMobileSecondCategoryClick(category: any) {
    if (this.normalizeId(category?.category_id) === 'all') {
      this.activeMobileSecondCategoryId = 'all';
      this.router.navigate(['/product-list'], {
        queryParams: {
          mode: 'browse',
        },
      });
      return;
    }

    if (!category?.category_id) {
      return;
    }

    this.activeMobileSecondCategoryId = this.normalizeId(category.category_id);
    this.router.navigate(['/product-list'], {
      queryParams: {
        categoryId: category.category_id,
        category_id: category.category_id,
        categoryName: category.category_name,
        mode: 'browse',
      },
    });
  }

  isMobileSecondCategoryActive(category: any): boolean {
    const categoryId = this.normalizeId(category?.category_id);
    if (categoryId === 'all') {
      return this.activeMobileSecondCategoryId === 'all';
    }
    return this.activeMobileSecondCategoryId === categoryId;
  }

  getMobileTopCategories(): any[] {
    const parentCategoriesFromFlat = this.allCategoriesFlat.filter((cat: any) => {
      const parentId = cat?.parent_id;
      return parentId == null || String(parentId).trim() === '';
    });
    const dynamic = this.allCategoryTree.length
      ? this.allCategoryTree
      : parentCategoriesFromFlat.length
        ? parentCategoriesFromFlat
        : this.categoryTree;
    return dynamic.length ? dynamic : this.mobileTopCategoryFallback;
  }

  getCategoryChipImage(category: any): string {
    const name = String(category?.category_name || '').toLowerCase();
    for (const key of Object.keys(this.categoryChipImages)) {
      if (name.includes(key)) {
        return this.categoryChipImages[key];
      }
    }
    return '/Categories1.jpg';
  }

  getCategorySidebarIconKey(category: any): string {
    const name = String(category?.category_name || '').toLowerCase();
    if (name.includes('book') || name.includes('stationery')) return 'book';
    if (name.includes('sport') || name.includes('outdoor')) return 'sport';
    if (name.includes('travel') || name.includes('luggage')) return 'travel';
    if (name.includes('home') || name.includes('living')) return 'home';
    if (name.includes('automotive') || name.includes('auto')) return 'automotive';
    if (name.includes('music') || name.includes('instrument')) return 'music';
    if (name.includes('electronic') || name.includes('& it')) return 'electronics';
    if (name.includes('gift') || name.includes('occasion')) return 'gift';
    if (name.includes('pet')) return 'pets';
    return 'default';
  }

  private startHeroImageRotation() {
    if (this.heroAds.length <= 1 || this.heroImageIntervalId) {
      return;
    }

    this.heroImageIntervalId = setInterval(() => {
      if (!this.isHeroImageTransitioning) {
        const next = (this.activeHeroImageIndex + 1) % this.heroAds.length;
        this.beginHeroTransition(next);
      }
    }, 3000);
  }

  getHeroSlideState(index: number): 'visible' | 'entering' | 'leaving' | 'hidden' {
    if (!this.isHeroImageTransitioning) {
      return index === this.activeHeroImageIndex ? 'visible' : 'hidden';
    }
    if (index === this.nextHeroImageIndex) {
      return 'entering';
    }
    if (index === this.activeHeroImageIndex) {
      return 'leaving';
    }
    return 'hidden';
  }

  getHeroCopyClasses(index: number): string {
    const state = this.getHeroSlideState(index);
    const dir = this.heroSlideDirection === 'prev' ? 'from-prev' : 'from-next';
    const base =
      'absolute inset-y-0 left-0 z-10 flex flex-col justify-center w-[58%] px-3 py-3 md:w-1/2 md:px-10 md:py-8 hero-copy';

    switch (state) {
      case 'visible':
        return `${base} is-visible ${dir}`;
      case 'entering':
        return `${base} is-entering ${dir}`;
      case 'leaving':
        return `${base} is-leaving ${dir} pointer-events-none`;
      default:
        return `${base} is-hidden ${dir} pointer-events-none`;
    }
  }

  getHeroProductWrapClasses(index: number): string {
    const state = this.getHeroSlideState(index);
    const base =
      'absolute inset-y-0 right-0 flex items-center justify-center w-[42%] h-full pr-1 md:w-1/2 md:pr-8 hero-product-wrap';

    switch (state) {
      case 'visible':
        return `${base} is-visible z-[2]`;
      case 'entering':
        return `${base} is-entering z-[3]`;
      case 'leaving':
        return `${base} is-leaving z-[2]`;
      default:
        return `${base} is-hidden z-0`;
    }
  }

  private beginHeroTransition(targetIndex: number): void {
    if (
      targetIndex < 0 ||
      targetIndex >= this.heroAds.length ||
      targetIndex === this.activeHeroImageIndex ||
      this.isHeroImageTransitioning
    ) {
      return;
    }

    if (this.heroImageTransitionTimeoutId) {
      clearTimeout(this.heroImageTransitionTimeoutId);
      this.heroImageTransitionTimeoutId = null;
    }

    const total = this.heroAds.length;
    const current = this.activeHeroImageIndex;
    const forwardSteps = (targetIndex - current + total) % total;
    const backwardSteps = (current - targetIndex + total) % total;
    this.heroSlideDirection = forwardSteps <= backwardSteps ? 'next' : 'prev';

    this.nextHeroImageIndex = targetIndex;
    this.isHeroImageTransitioning = true;
    this.cdr.markForCheck();

    this.heroImageTransitionTimeoutId = setTimeout(() => {
      this.completeHeroTransition();
    }, this.heroTransitionMs + 80);
  }

  private completeHeroTransition(): void {
    if (!this.isHeroImageTransitioning) {
      return;
    }

    if (this.heroImageTransitionTimeoutId) {
      clearTimeout(this.heroImageTransitionTimeoutId);
      this.heroImageTransitionTimeoutId = null;
    }

    this.activeHeroImageIndex = this.nextHeroImageIndex;
    this.isHeroImageTransitioning = false;
    this.cdr.markForCheck();
  }

  onHeroSlideTransitionEnd(event: TransitionEvent): void {
    if (!this.isHeroImageTransitioning || event.propertyName !== 'transform') {
      return;
    }

    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-hero-slide')) {
      return;
    }

    const slideIndex = Number(target.dataset['slideIndex']);
    if (slideIndex !== this.nextHeroImageIndex) {
      return;
    }

    this.completeHeroTransition();
  }

  goToHeroSlide(index: number) {
    this.beginHeroTransition(index);
  }

  onHeroAdClick(ad?: (typeof this.heroAds)[number]) {
    const target = ad ?? this.heroAds[this.activeHeroImageIndex];
    this.router.navigate(['/product-list'], {
      queryParams: target?.queryParams ?? { mode: 'browse' },
    });
  }

  scrollRecentlyViewed(direction: 'left' | 'right') {
    if (this.recentlyViewedCarousel?.nativeElement) {
      const scrollAmount = 280;
      const currentScroll = this.recentlyViewedCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.recentlyViewedCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
    }
  }

  scrollInterestCategories(direction: 'left' | 'right') {
    this.pauseInterestMarquee(2200);
    if (this.interestCarousel?.nativeElement) {
      const scrollAmount = 300;
      const currentScroll = this.interestCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.interestCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
    }
  }

  scrollBrandPartners(direction: 'left' | 'right') {
    this.pauseBrandMarquee(2200);
    if (this.brandCarousel?.nativeElement) {
      const scrollAmount = 280;
      const currentScroll = this.brandCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.brandCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
    }
  }

  trackInterestMarqueeItem(index: number, item: any): string {
    return `${index}-${item?.category_id ?? item?.category_name ?? index}`;
  }

  trackBrandMarqueeItem(index: number, item: { name: string }): string {
    return `${index}-${item.name}`;
  }

  getBrandNameClasses(style?: 'light' | 'semibold' | 'bold'): string {
    if (style === 'light') return 'text-2xl font-light text-gray-800 md:text-3xl';
    if (style === 'semibold') return 'text-base font-semibold text-gray-800 md:text-xl';
    return 'text-lg font-bold text-gray-800 md:text-2xl';
  }

  onInterestMarqueeEnter(): void {
    this.interestMarqueeHovered = true;
    this.pauseInterestMarquee();
  }

  onInterestMarqueeLeave(): void {
    this.interestMarqueeHovered = false;
    this.resumeInterestMarquee();
  }

  onBrandMarqueeEnter(): void {
    this.brandMarqueeHovered = true;
    this.pauseBrandMarquee();
  }

  onBrandMarqueeLeave(): void {
    this.brandMarqueeHovered = false;
    this.resumeBrandMarquee();
  }

  onMarqueeWheel(kind: 'interest' | 'brand', event: WheelEvent): void {
    const el =
      kind === 'interest' ? this.interestCarousel?.nativeElement : this.brandCarousel?.nativeElement;
    if (!el) return;

    // Prefer horizontal intent; convert vertical wheel to horizontal scroll while over the strip.
    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;

    event.preventDefault();
    el.scrollLeft += delta;
    this.wrapMarqueeScroll(el);
    if (kind === 'interest') this.pauseInterestMarquee(2000);
    else this.pauseBrandMarquee(2000);
  }

  onMarqueePointerDown(kind: 'interest' | 'brand', event: PointerEvent): void {
    const el =
      kind === 'interest' ? this.interestCarousel?.nativeElement : this.brandCarousel?.nativeElement;
    if (!el || event.button !== 0) return;

    this.dragScrollState = {
      el,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture?.(event.pointerId);
    if (kind === 'interest') this.pauseInterestMarquee();
    else this.pauseBrandMarquee();
  }

  onMarqueePointerMove(event: PointerEvent): void {
    const state = this.dragScrollState;
    if (!state) return;

    const dx = event.clientX - state.startX;
    if (Math.abs(dx) > 4) state.moved = true;
    state.el.scrollLeft = state.startScroll - dx;

    const half = state.el.scrollWidth / 2;
    if (half <= 0) return;

    if (state.el.scrollLeft >= half) {
      state.el.scrollLeft -= half;
      state.startScroll = state.el.scrollLeft;
      state.startX = event.clientX;
    } else if (state.el.scrollLeft <= 0 && dx > 0) {
      state.el.scrollLeft += half;
      state.startScroll = state.el.scrollLeft;
      state.startX = event.clientX;
    }
  }

  onMarqueePointerUp(kind: 'interest' | 'brand', event: PointerEvent): void {
    const state = this.dragScrollState;
    if (!state) return;

    state.el.releasePointerCapture?.(event.pointerId);
    const wasDrag = state.moved;
    this.dragScrollState = null;

    if (wasDrag) {
      this.suppressNextClick = true;
      event.preventDefault();
      event.stopPropagation();
    }

    const hovered = kind === 'interest' ? this.interestMarqueeHovered : this.brandMarqueeHovered;
    if (!hovered) {
      if (kind === 'interest') this.pauseInterestMarquee(1800);
      else this.pauseBrandMarquee(1800);
    }
  }

  pauseInterestMarquee(resumeAfterMs = 0): void {
    this.interestMarqueePaused = true;
    if (this.interestMarqueeResumeTimer) {
      clearTimeout(this.interestMarqueeResumeTimer);
      this.interestMarqueeResumeTimer = null;
    }
    if (resumeAfterMs > 0 && !this.interestMarqueeHovered) {
      this.interestMarqueeResumeTimer = setTimeout(() => {
        this.interestMarqueePaused = false;
        this.interestMarqueeResumeTimer = null;
      }, resumeAfterMs);
    }
  }

  resumeInterestMarquee(): void {
    if (this.interestMarqueeResumeTimer) {
      clearTimeout(this.interestMarqueeResumeTimer);
      this.interestMarqueeResumeTimer = null;
    }
    if (!this.interestMarqueeHovered) {
      this.interestMarqueePaused = false;
    }
  }

  pauseBrandMarquee(resumeAfterMs = 0): void {
    this.brandMarqueePaused = true;
    if (this.brandMarqueeResumeTimer) {
      clearTimeout(this.brandMarqueeResumeTimer);
      this.brandMarqueeResumeTimer = null;
    }
    if (resumeAfterMs > 0 && !this.brandMarqueeHovered) {
      this.brandMarqueeResumeTimer = setTimeout(() => {
        this.brandMarqueePaused = false;
        this.brandMarqueeResumeTimer = null;
      }, resumeAfterMs);
    }
  }

  resumeBrandMarquee(): void {
    if (this.brandMarqueeResumeTimer) {
      clearTimeout(this.brandMarqueeResumeTimer);
      this.brandMarqueeResumeTimer = null;
    }
    if (!this.brandMarqueeHovered) {
      this.brandMarqueePaused = false;
    }
  }

  private isDesktopMarquee(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  }

  private wrapMarqueeScroll(el: HTMLElement): void {
    const half = el.scrollWidth / 2;
    if (half > 0 && el.scrollLeft >= half) {
      el.scrollLeft -= half;
    }
  }

  private syncInterestMarquee(): void {
    if (this.isDesktopMarquee() && this.interestMarqueeCategories.length > 0) {
      this.startInterestMarquee();
    } else {
      this.stopInterestMarquee();
    }
  }

  private syncBrandMarquee(): void {
    if (this.brandMarqueeItems.length > 0) {
      this.startBrandMarquee();
    } else {
      this.stopBrandMarquee();
    }
  }

  private startInterestMarquee(): void {
    this.stopInterestMarquee(false);
    if (!this.isDesktopMarquee() || !this.interestMarqueeCategories.length) {
      return;
    }

    const tick = () => {
      const el = this.interestCarousel?.nativeElement;
      if (el && !this.interestMarqueePaused) {
        el.scrollLeft += this.interestMarqueeSpeed;
        this.wrapMarqueeScroll(el);
      }
      this.interestMarqueeRaf = requestAnimationFrame(tick);
    };
    this.interestMarqueeRaf = requestAnimationFrame(tick);
  }

  private startBrandMarquee(): void {
    this.stopBrandMarquee(false);
    if (!this.brandMarqueeItems.length) {
      return;
    }

    const tick = () => {
      const el = this.brandCarousel?.nativeElement;
      if (el && !this.brandMarqueePaused) {
        el.scrollLeft += this.brandMarqueeSpeed;
        this.wrapMarqueeScroll(el);
      }
      this.brandMarqueeRaf = requestAnimationFrame(tick);
    };
    this.brandMarqueeRaf = requestAnimationFrame(tick);
  }

  private stopInterestMarquee(clearResume = true): void {
    if (this.interestMarqueeRaf != null) {
      cancelAnimationFrame(this.interestMarqueeRaf);
      this.interestMarqueeRaf = null;
    }
    if (clearResume && this.interestMarqueeResumeTimer) {
      clearTimeout(this.interestMarqueeResumeTimer);
      this.interestMarqueeResumeTimer = null;
    }
  }

  private stopBrandMarquee(clearResume = true): void {
    if (this.brandMarqueeRaf != null) {
      cancelAnimationFrame(this.brandMarqueeRaf);
      this.brandMarqueeRaf = null;
    }
    if (clearResume && this.brandMarqueeResumeTimer) {
      clearTimeout(this.brandMarqueeResumeTimer);
      this.brandMarqueeResumeTimer = null;
    }
  }

  onProductDetails() {
    this.router.navigate(['/product-list'], {
      queryParams: {
        mode: 'browse',
      },
    });
  }

  onNewArrivalsSeeAll() {
    this.router.navigate(['/product-list'], {
      queryParams: {
        mode: 'browse',
        new_arrivals: 'T',
      },
    });
  }

  onFeaturedProductsSeeAll() {
    this.router.navigate(['/product-list'], {
      queryParams: {
        mode: 'browse',
        featured: 'T',
      },
    });
  }
}
