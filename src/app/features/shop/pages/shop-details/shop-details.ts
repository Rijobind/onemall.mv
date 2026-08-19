import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { ShopProducts } from "../shop-products/shop-products";
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import {
  formatShopLocation,
  resolveCurrencySymbol,
  resolveStoreAddressRegion,
} from '../../../../core/utils/marketplace-shop.util';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';
import { buildProductCommands } from '../../../../core/utils/product-url.util';
import { ProductCardSkeleton } from '../../../../shared/components/product-card-skeleton/product-card-skeleton';
import { ActivatedRoute, Router } from '@angular/router';
import { FollowService } from '../../../../core/services/follow.service/follow.service';

@Component({
  selector: 'app-shop-details',
  imports: [CommonModule, RouterModule, FormsModule, Header, Footer, ShopProducts, ProductCardSkeleton],
  templateUrl: './shop-details.html',
  styleUrl: './shop-details.css',
})
export class ShopDetails implements OnInit, OnDestroy {
  private readonly fallbackShop = {
    id: '1',
    name: 'Premium Electronics',
    description: 'Your trusted source for premium electronics and tech accessories. We offer the latest gadgets, accessories, and tech solutions for your everyday needs.',
    logo: '/shirt.jpg',
    coverImage: '/mobile3.jpg',
    rating: 4.8,
    reviews: 2540,
    responseRate: 98,
    responseTime: 'Within 1 hour',
    itemsSold: 15200,
    followers: 8500,
    joinedDate: 'January 2020',
    location: 'Malé, Kaafu',
    atoll: 'Kaafu',
    city: 'Malé',
    verified: true
  };
  private allApiProducts: any[] = [];
  private categoryLookup: Map<string, string> = new Map();
  selectedCategory: string = 'all';
  sortBy: string = 'newest';
  currentStoreId: string = '';
  isShopDataFromApi: boolean = false;
  shopCurrencyCode: string = '';
  shopCurrencySymbol: string = '$';
  isLoading: boolean = true;
  activeMobileTab: 'items' | 'categories' | 'reviews' = 'items';
  shopSearchQuery: string = '';
  private isStoreLoaded: boolean = false;
  private isProductsLoaded: boolean = false;
  isFollowing = false;
  followActionLoading = false;

  shop = { ...this.fallbackShop };

  categories: Array<{ id: string; name: string; count: number; isApiData?: boolean }> = [];

  allProducts: any[] = [];

  get filteredProducts() {
    if (this.selectedCategory === 'all') {
      return this.allProducts;
    }
    return this.allProducts.filter(product => product.category === this.selectedCategory);
  }

  get sortedProducts() {
    const products = [...this.filteredProducts];
    switch (this.sortBy) {
      case 'relevance':
        return products;
      case 'top-sales':
        return products.sort((a, b) => b.sold - a.sold);
      case 'most-recent':
      case 'newest':
        return products.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      case 'price-low':
        return products.sort((a, b) => a.price - b.price);
      case 'price-high':
        return products.sort((a, b) => b.price - a.price);
      case 'rating':
        return products.sort((a, b) => b.rating - a.rating);
      default:
        return products.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }
  }

  get mobileTabProducts() {
    const term = this.shopSearchQuery.trim().toLowerCase();
    const source = [...this.sortedProducts];
    if (!term) return source;
    return source.filter((product: any) =>
      String(product?.name || '').toLowerCase().includes(term)
    );
  }

  get desktopFilteredProducts() {
    const term = this.shopSearchQuery.trim().toLowerCase();
    if (!term) return this.filteredProducts;
    return this.filteredProducts.filter((product: any) =>
      String(product?.name || '').toLowerCase().includes(term)
    );
  }

  private readonly regionUpdatedHandler = () => this.loadApiDataInConsole();
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.loadApiDataInConsole(detail?.currency_code);
  };

  constructor(
    private backendapiServices: BackendapiServices,
    private route: ActivatedRoute,
    private router: Router,
    private regionService: RegionService,
    private currencyService: CurrencyService,
    private followService: FollowService,
    private cdr: ChangeDetectorRef
  ) {}

  onProductClick(product: any): void {
    if (!product?.id && !product?.slug) return;
    const storeId = this.normalizeId(product?.store_id || this.currentStoreId);
    if (storeId && typeof window !== 'undefined') {
      localStorage.setItem('store_id', storeId);
    }
    const link = buildProductCommands({ ...product, store_id: storeId });
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  ngOnInit() {
    this.currentStoreId = this.getStoreIdForApi();
    this.isLoading = true;
    this.isStoreLoaded = false;
    this.isProductsLoaded = false;
    this.loadCategoryMapAndData();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
      window.addEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
      window.removeEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.activeMobileTab = 'items';
  }

  onSortChange(sortValue: string) {
    this.sortBy = sortValue;
  }

  setMobileTab(tab: 'items' | 'categories' | 'reviews') {
    this.activeMobileTab = tab;
  }

  setMobileSort(sortValue: string) {
    this.sortBy = sortValue;
  }

  private loadApiDataInConsole(currencyOverride?: string) {
    const generation = this.currencyService.fetchGeneration;
    const requestParams = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );

    this.loadStoreDetails();
    this.backendapiServices
      .getMarketplaceProductsWithFallback(requestParams)
      .subscribe({
      next: (response: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const apiProducts = this.backendapiServices.extractProductsFromResponse(response);
        this.allApiProducts = Array.isArray(apiProducts) ? apiProducts : [];

        this.populateProductsAndCategories();
        this.applyShopRegionFromProducts();
        this.isProductsLoaded = true;
        this.updateLoadingState();
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.allProducts = [];
        this.categories = [];
        this.isProductsLoaded = true;
        this.updateLoadingState();
      },
    });
  }

  private loadStoreDetails(): void {
    if (!this.currentStoreId) {
      this.isShopDataFromApi = false;
      this.shop = { ...this.fallbackShop };
      this.isStoreLoaded = true;
      this.updateLoadingState();
      return;
    }

    this.backendapiServices.getstores(this.currentStoreId).subscribe({
      next: (response: any) => {
        const payload = response?.data ?? response ?? {};
        const store = Array.isArray(payload) ? payload[0] : payload;

        const { atoll, city } = resolveStoreAddressRegion(store);
        const locationLabel =
          formatShopLocation(atoll, city) ||
          String(store?.store_location || store?.location || store?.address || '').trim() ||
          this.fallbackShop.location;

        this.isShopDataFromApi = true;
        this.shop = {
          ...this.fallbackShop,
          id: String(store?.store_id ?? store?.storeId ?? this.currentStoreId ?? this.fallbackShop.id),
          name: store?.store_name || store?.name || store?.store || this.fallbackShop.name,
          description: store?.description || this.fallbackShop.description,
          logo: store?.logo || store?.logo_url || store?.image || this.fallbackShop.logo,
          rating: Number(store?.rating || store?.average_rating || this.fallbackShop.rating),
          reviews: Number(store?.reviews || store?.review_count || store?.total_reviews || this.fallbackShop.reviews),
          responseRate: Number(store?.response_rate || this.fallbackShop.responseRate),
          responseTime: store?.response_time || this.fallbackShop.responseTime,
          itemsSold: Number(store?.items_sold || store?.total_sold || store?.sold_count || this.fallbackShop.itemsSold),
          followers: Number(store?.followers || store?.follower_count || this.fallbackShop.followers),
          joinedDate: store?.joined_date || store?.created_at || this.fallbackShop.joinedDate,
          atoll: atoll || this.fallbackShop.atoll,
          city: city || this.fallbackShop.city,
          location: locationLabel,
          verified: store?.verified === undefined ? this.fallbackShop.verified : !!store.verified,
        };
        this.shopCurrencyCode = String(store?.default_currency || '').trim().toUpperCase();
        this.shopCurrencySymbol = resolveCurrencySymbol(this.shopCurrencyCode);
        this.isStoreLoaded = true;
        this.updateLoadingState();
        this.loadFollowStatus();
      },
      error: () => {
        this.isShopDataFromApi = false;
        this.shop = { ...this.fallbackShop };
        this.shopCurrencyCode = '';
        this.shopCurrencySymbol = '$';
        this.isStoreLoaded = true;
        this.updateLoadingState();
        this.loadFollowStatus();
      },
    });
  }

  toggleFollowShop(event?: Event): void {
    event?.stopPropagation();
    const storeId = this.normalizeId(this.shop?.id || this.currentStoreId);
    if (!storeId || this.followActionLoading) return;

    const wasFollowing = this.isFollowing;
    this.followActionLoading = true;
    this.followService.toggleFollow(storeId, wasFollowing).subscribe({
      next: (result) => {
        this.followActionLoading = false;
        if (result === 'login_required') return;
        this.isFollowing = result === true;
        if (this.isFollowing && !wasFollowing) {
          this.shop.followers = (Number(this.shop.followers) || 0) + 1;
        } else if (!this.isFollowing && wasFollowing) {
          this.shop.followers = Math.max(0, (Number(this.shop.followers) || 0) - 1);
        }
      },
      error: () => {
        this.followActionLoading = false;
      },
    });
  }

  private loadFollowStatus(): void {
    const storeId = this.normalizeId(this.shop?.id || this.currentStoreId);
    if (!storeId) return;

    this.followService.getFollowStatus(storeId).subscribe({
      next: (status) => {
        this.isFollowing = !!status.is_following;
        if (status.follower_count > 0 || this.isShopDataFromApi) {
          this.shop.followers = status.follower_count;
        }
      },
    });
  }

  private applyShopRegionFromProducts(): void {
    if (!this.allApiProducts.length) return;

    const productWithRegion = this.allApiProducts.find((product: any) => product?.store_region);
    if (!productWithRegion?.store_region) return;

    const atoll = String(productWithRegion.store_region.region_name || '').trim();
    const city = String(productWithRegion.store_region.city || '').trim();
    const locationLabel = formatShopLocation(atoll, city);
    if (!locationLabel) return;

    this.shop = {
      ...this.shop,
      atoll: this.shop.atoll || atoll,
      city: this.shop.city || city,
      location: this.shop.location || locationLabel,
    };
  }

  private getStoreIdForApi(): string {
    const routeStoreId =
      this.route.snapshot.queryParamMap.get('store_id') ||
      this.route.snapshot.queryParamMap.get('storeId');

    if (routeStoreId) {
      return routeStoreId;
    }

    if (typeof window !== 'undefined') {
      const savedStoreId =
        localStorage.getItem('store_id') ||
        sessionStorage.getItem('store_id') ||
        localStorage.getItem('storeId') ||
        sessionStorage.getItem('storeId');

      if (savedStoreId) {
        return savedStoreId;
      }
    }

    // Fallback only for debugging logs until data binding is finalized.
    return '1';
  }

  private loadCategoryMapAndData(): void {
    this.backendapiServices.getAllCategoryList().subscribe({
      next: (response) => {
        const list = response?.data || [];
        this.categoryLookup.clear();
        (Array.isArray(list) ? list : []).forEach((category: any) => {
          const id = this.normalizeId(category?.category_id ?? category?.id);
          const name = category?.category_name || category?.name || id;
          if (id) {
            this.categoryLookup.set(id, name);
          }
        });
        this.loadApiDataInConsole();
      },
      error: () => {
        this.categoryLookup.clear();
        this.loadApiDataInConsole();
      },
    });
  }

  private populateProductsAndCategories(): void {
    const normalizedStoreId = this.normalizeId(this.currentStoreId);
    const storeProducts = this.allApiProducts.filter((product: any) => {
      const variant = product?.im_ProductVariants?.[0];
      const productStoreId = this.resolveStoreId(product, variant);
      return normalizedStoreId ? productStoreId === normalizedStoreId : true;
    });

    if (!storeProducts.length) {
      this.allProducts = [];
      this.categories = [];
      return;
    }

    this.allProducts = storeProducts.map((product: any) => {
      const variant = product?.im_ProductVariants?.[0] || {};
      const images = Array.isArray(variant?.im_ProductImages) ? variant.im_ProductImages : [];
      const imageUrl = images.find((img: any) => img?.is_primary === 'T')?.image_url
        || images[0]?.image_url
        || product?.thumbnail_url
        || '/mobile.jpg';
      const categoryKey =
        this.normalizeId(product?.sub_sub_category_id) ||
        this.normalizeId(product?.sub_category_id) ||
        this.normalizeId(product?.category_id) ||
        'uncategorized';
      const display = resolveVariantDisplayPrice(variant, product);

      return {
        id: product?.product_id,
        slug: String(product?.slug || '').trim() || undefined,
        store_id: this.resolveStoreId(product, variant),
        name: product?.title || 'Untitled Product',
        price: display.price,
        originalPrice: display.originalPrice,
        rating: Number(product?.rating || 0),
        reviews: Number(product?.review_count || 0),
        sold: Number(product?.sold_count || 0),
        image: imageUrl,
        category: categoryKey,
        inStock: Number(variant?.im_StoreVariantInventory?.[0]?.on_hand_quantity || 0) > 0,
        store_currency_code: display.display_currency || this.shopCurrencyCode,
        store_currency_symbol: display.display_symbol || this.shopCurrencySymbol,
        isApiData: true,
      };
    });

    const categoryCountMap = new Map<string, { name: string; count: number }>();
    this.allProducts.forEach((product: any) => {
      const categoryId = this.normalizeId(product?.category);
      const existing = categoryCountMap.get(categoryId);
      if (existing) {
        existing.count += 1;
      } else {
        categoryCountMap.set(categoryId, {
          name: this.categoryLookup.get(categoryId) || 'Other',
          count: 1,
        });
      }
    });

    this.categories = [
      { id: 'all', name: 'All Products', count: this.allProducts.length, isApiData: true },
      ...Array.from(categoryCountMap.entries()).map(([id, entry]) => ({
        id,
        name: entry.name,
        count: entry.count,
        isApiData: true,
      })),
    ];
    this.selectedCategory = 'all';
  }

  private updateLoadingState(): void {
    this.isLoading = !(this.isStoreLoaded && this.isProductsLoaded);
    this.cdr.markForCheck();
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
}
