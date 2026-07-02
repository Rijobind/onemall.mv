import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { resolveStoreRegionFromProduct } from '../../../../core/utils/marketplace-shop.util';

export interface HomeProductCard {
  id: string;
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
  category_id?: string;
  sub_category_id?: string;
  sub_sub_category_id?: string;
  created_at?: string;
  featured_item?: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, Header, Footer, ShopNameLink],
  templateUrl: './home.html',
  host: { class: 'block max-w-full overflow-x-hidden' },
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('recentlyViewedCarousel') recentlyViewedCarousel?: ElementRef<HTMLElement>;
  @ViewChild('interestCarousel') interestCarousel?: ElementRef<HTMLElement>;

  categoryTree: any[] = [];
  allCategoryTree: any[] = []; // Full category tree
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
      image: '/chair.jpg',
      badge: 'Home & Living',
      title: 'Elevate Your Space',
      subtitle: 'Premium furniture & decor — crafted for modern living',
      cta: 'Shop Furniture',
      discount: '30% OFF',
      queryParams: { mode: 'browse', type: 'home' },
    },
    {
      image: '/adverticement.jpg',
      badge: 'Mega Sale',
      title: 'Deals You’ll Love',
      subtitle: 'Save big across electronics, fashion, and more',
      cta: 'View All Deals',
      discount: 'UP TO 50%',
      queryParams: { mode: 'browse' },
    },
    {
      image: '/Categories1.jpg',
      badge: 'Electronics',
      title: 'Next-Gen Tech',
      subtitle: 'Phones, laptops & gadgets at unbeatable prices',
      cta: 'Shop Electronics',
      discount: 'NEW IN',
      queryParams: { mode: 'browse', type: 'electronics' },
    },
    {
      image: '/shirt.jpg',
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
  isHeroPaused: boolean = false;
  heroSlideDirection: 'next' | 'prev' = 'next';
  readonly heroTransitionMs = 750;
  private heroImageIntervalId: ReturnType<typeof setInterval> | null = null;
  private heroImageTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly recentlyViewedStorageKey = 'recently_viewed_products';
  private readonly recentSearchesStorageKey = 'recent_searches';
  private allCategoriesFlat: any[] = [];
  private allMarketplaceCards: HomeProductCard[] = [];
  private readonly regionUpdatedHandler = () => this.loadMarketplaceProducts();

  newArrivals: HomeProductCard[] = [];
  featuredProducts: HomeProductCard[] = [];
  discoverProductsForYou: HomeProductCard[] = [];
  recentlyViewed: HomeProductCard[] = [];

  constructor(
    private router: Router,
    private api: BackendapiServices,
    private regionService: RegionService,
    private shopService: MarketplaceShopService
  ) {}

  ngOnInit(): void {
    this.loadCategory();
    this.loadMarketplaceProducts();
    this.startHeroImageRotation();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
    }
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

      // Limit to 9 categories for home page
      this.categoryTree = allCategoryTree.slice(0, 9);
      this.refreshProductSections();
    });
  }

  private loadMarketplaceProducts(): void {
    this.api.getMarketplaceProductsWithFallback(this.regionService.getProductRequestParams()).subscribe({
      next: (res: any) => {
        const rawList = this.api.extractProductsFromResponse(res);
        const cards = rawList.map((product: any) => this.mapApiProductToCard(product));
        this.shopService.enrichWithShopNames(cards).subscribe({
          next: (enriched) => {
            this.allMarketplaceCards = enriched;
            this.refreshProductSections();
          },
          error: () => {
            this.allMarketplaceCards = cards;
            this.refreshProductSections();
          },
        });
      },
      error: () => {
        this.allMarketplaceCards = [];
        this.newArrivals = [];
        this.featuredProducts = [];
        this.discoverProductsForYou = [];
        this.buildRecentlyViewed();
      },
    });
  }

  private extractProductList(res: any): any[] {
    return this.api.extractProductsFromResponse(res);
  }

  private mapApiProductToCard(product: any): HomeProductCard {
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
    const categoryId = this.normalizeId(product?.category_id);
    const subCategoryId = this.normalizeId(product?.sub_category_id);
    const subSubCategoryId = this.normalizeId(product?.sub_sub_category_id);
    const { atoll, city } = resolveStoreRegionFromProduct(product);
    const apiRating = Number(product?.rating ?? product?.average_rating ?? 0);
    const rating = apiRating > 0 ? apiRating : Math.round((4 + Math.random()) * 10) / 10;

    return {
      id: this.normalizeId(product?.product_id ?? product?.id),
      name: product?.title || 'Untitled Product',
      category: this.resolveCategoryName(categoryId, subCategoryId, subSubCategoryId),
      price: basePrice,
      originalPrice: basePrice > 0 ? Math.round(basePrice * 1.2 * 100) / 100 : 0,
      image: imageUrl,
      rating,
      store_id: this.resolveStoreId(product, variant),
      shop_atoll: atoll,
      shop_city: city,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      sub_sub_category_id: subSubCategoryId,
      created_at: product?.created_at || product?.updated_at || '',
      featured_item: String(product?.featured_item ?? '').trim(),
    };
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

  private buildNewArrivals(): void {
    this.newArrivals = [...this.allMarketplaceCards]
      .sort((a, b) => this.getProductTimestamp(b) - this.getProductTimestamp(a))
      .slice(0, 8);
  }

  private buildFeaturedProducts(): void {
    this.featuredProducts = this.allMarketplaceCards
      .filter((product) => this.isFeaturedProduct(product))
      .slice(0, 8);
  }

  private buildDiscoverProductsForYou(): void {
    const searchTerm = this.getLatestSearchTerm();
    if (!searchTerm || !this.allMarketplaceCards.length) {
      this.discoverProductsForYou = this.allMarketplaceCards.slice(0, 5);
      return;
    }

    const term = searchTerm.toLowerCase();
    const directMatches = this.allMarketplaceCards.filter((product) =>
      this.productMatchesSearchTerm(product, term)
    );

    const relatedCategoryIds = new Set<string>();
    directMatches.forEach((product) => {
      [product.category_id, product.sub_category_id, product.sub_sub_category_id]
        .filter((id) => !!id)
        .forEach((id) => relatedCategoryIds.add(id!));
    });

    const categoryRelated = this.allMarketplaceCards.filter((product) => {
      const ids = [product.category_id, product.sub_category_id, product.sub_sub_category_id].filter(
        (id) => !!id
      ) as string[];
      return ids.some((id) => relatedCategoryIds.has(id));
    });

    const merged = [...directMatches, ...categoryRelated];
    const unique = new Map<string, HomeProductCard>();
    merged.forEach((product) => {
      if (product.id) unique.set(product.id, product);
    });
    const discovered = Array.from(unique.values()).slice(0, 8);
    this.discoverProductsForYou = discovered.length
      ? discovered
      : this.allMarketplaceCards.slice(0, 8);
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
    this.shopService.enrichWithShopNames(limited).subscribe({
      next: (enriched) => {
        this.recentlyViewed = enriched;
      },
      error: () => {
        this.recentlyViewed = limited;
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
    if (!product?.id) return;
    if (product.store_id && typeof window !== 'undefined') {
      localStorage.setItem('store_id', product.store_id);
    }
    this.router.navigate(['/product-details'], {
      queryParams: {
        productId: product.id,
        store_id: product.store_id || undefined,
      },
    });
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
      if (!this.isHeroPaused && !this.isHeroImageTransitioning) {
        const next = (this.activeHeroImageIndex + 1) % this.heroAds.length;
        this.beginHeroTransition(next);
      }
    }, 5000);
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

  getHeroSlideClasses(index: number): string {
    const state = this.getHeroSlideState(index);
    const base =
      'absolute inset-0 transition-opacity duration-700 ease-in-out will-change-[opacity]';

    switch (state) {
      case 'visible':
        return `${base} z-[1] opacity-100 visible`;
      case 'entering':
        return `${base} z-[2] opacity-100 visible`;
      case 'leaving':
        return `${base} z-[1] opacity-0 visible`;
      default:
        return `${base} z-0 opacity-0 invisible`;
    }
  }

  getHeroBgClasses(index: number): string {
    const base = 'absolute inset-0 bg-center bg-cover';
    return this.getHeroSlideState(index) === 'visible'
      ? `${base} scale-110 transition-transform duration-[9000ms] ease-linear`
      : `${base} scale-100`;
  }

  getHeroCopyClasses(index: number): string {
    const state = this.getHeroSlideState(index);
    const base =
      'absolute inset-0 flex flex-col justify-center max-w-xl px-4 py-5 md:px-10 md:py-8 transition-[opacity,transform] ease-out';
    const isPrev = this.heroSlideDirection === 'prev';

    switch (state) {
      case 'visible':
      case 'entering':
        return `${base} z-[2] opacity-100 translate-x-0 visible pointer-events-auto duration-[600ms]`;
      case 'leaving':
        return `${base} z-[1] opacity-0 visible pointer-events-none duration-[450ms] ${isPrev ? 'translate-x-6' : '-translate-x-6'}`;
      default:
        return `${base} z-0 opacity-0 invisible pointer-events-none duration-[600ms] ${isPrev ? '-translate-x-8' : 'translate-x-8'}`;
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
  }

  onHeroSlideTransitionEnd(event: TransitionEvent): void {
    if (!this.isHeroImageTransitioning || event.propertyName !== 'opacity') {
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

  previousHeroSlide() {
    const prev =
      (this.activeHeroImageIndex - 1 + this.heroAds.length) % this.heroAds.length;
    this.beginHeroTransition(prev);
  }

  nextHeroSlide() {
    const next = (this.activeHeroImageIndex + 1) % this.heroAds.length;
    this.beginHeroTransition(next);
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
    if (this.interestCarousel?.nativeElement) {
      const scrollAmount = 300;
      const currentScroll = this.interestCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.interestCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
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
