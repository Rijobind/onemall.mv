import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { CurrencyService } from '../../../core/services/currency.service/currency.service';
import { ShopNameLink } from '../../../shared/components/shop-name-link/shop-name-link';
import { FavoritesService } from '../../../core/services/favorites.service/favorites.service';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service/action-feedback.service';
import { Header } from '../../../shared/components/header/header';
import { MobileCart } from '../../../core/models/mobile-cart/mobile-cart';
import { CartModel, CartModelMode } from '../models/cart-model/cart-model';
import { ProductCardSkeleton } from '../../../shared/components/product-card-skeleton/product-card-skeleton';
import { resolveVariantDisplayPrice } from '../../../core/utils/marketplace-price.util';
import { buildProductCommands } from '../../../core/utils/product-url.util';

@Component({
  selector: 'app-search-result',
  imports: [CommonModule, Header, MobileCart, ShopNameLink, CartModel, ProductCardSkeleton],
  templateUrl: './search-result.html',
  styleUrl: './search-result.css',
})
export class SearchResult implements OnInit, OnDestroy {
  private apiProductsById = new Map<string, any>();
  searchQuery: string = '';
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  isLoading = true;
  readonly pageSize = 36;
  visibleCount = 36;
  isMobileCartModalOpen = false;
  isCartModalOpen = false;
  cartModalMode: CartModelMode = 'add';
  cartModalApiProduct: any = null;
  cartModalStoreId = '';
  selectedCartItem: {
    name: string;
    image: string;
    quantity: number;
    price: number;
    shipping: number;
  } | null = null;
  sortBy: string = 'featured';
  isSortOpen: boolean = false;

  readonly quickFilters: Array<{ label: string; icon?: 'filter'; caret?: boolean }> = [
    { label: 'Filters', icon: 'filter' },
    { label: 'Sort by', caret: true },
    { label: 'Category', caret: true },
    { label: 'Size', caret: true },
    { label: 'Color', caret: true },
  ];
  sortOptions = [
    { label: 'Featured', value: 'featured' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Newest Arrivals', value: 'newest' },
  ];

  searchResultAdImages = ['/mobile3.jpg', '/mobile4.jpg', '/mobile2.jpg', '/mobile.jpg'];
  currentSearchResultAdIndex = 0;
  searchResultAdFading = false;
  private searchResultAdInterval: ReturnType<typeof setInterval> | null = null;
  private searchResultAdFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly regionUpdatedHandler = () => this.loadProducts();
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.loadProducts(detail?.currency_code);
  };

  get currentSearchResultAdImage(): string {
    return this.searchResultAdImages[this.currentSearchResultAdIndex];
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: BackendapiServices,
    private favoritesService: FavoritesService,
    private actionFeedback: ActionFeedbackService,
    private regionService: RegionService,
    private shopService: MarketplaceShopService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef
  ) {}

  get displayedProducts(): any[] {
    return this.filteredProducts.slice(0, this.visibleCount);
  }

  get hasMoreProducts(): boolean {
    return this.visibleCount < this.filteredProducts.length;
  }

  loadMoreProducts(): void {
    this.visibleCount = Math.min(
      this.visibleCount + this.pageSize,
      this.filteredProducts.length
    );
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.startSearchResultAdRotation();
    this.loadProducts();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
      window.addEventListener('currency-updated', this.currencyUpdatedHandler);
    }
    this.route.queryParams.subscribe((params) => {
      this.searchQuery = String(params['search'] || '').trim();
      this.filterProducts();
    });
  }

  ngOnDestroy(): void {
    this.stopSearchResultAdRotation();
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
      window.removeEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  private startSearchResultAdRotation(): void {
    this.stopSearchResultAdRotation();
    this.searchResultAdInterval = setInterval(() => {
      this.searchResultAdFading = true;
      this.searchResultAdFadeTimer = setTimeout(() => {
        this.currentSearchResultAdIndex =
          (this.currentSearchResultAdIndex + 1) % this.searchResultAdImages.length;
        this.searchResultAdFading = false;
      }, 550);
    }, 5200);
  }

  private stopSearchResultAdRotation(): void {
    if (this.searchResultAdInterval) {
      clearInterval(this.searchResultAdInterval);
      this.searchResultAdInterval = null;
    }
    if (this.searchResultAdFadeTimer) {
      clearTimeout(this.searchResultAdFadeTimer);
      this.searchResultAdFadeTimer = null;
    }
  }

  onSearchResultAdClick(): void {
    this.router.navigate(['/product-list']);
  }

  private loadProducts(currencyOverride?: string): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    const generation = this.currencyService.fetchGeneration;
    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );
    this.api.getMarketplaceProductsWithFallback(params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const apiProducts = this.api.extractProductsFromResponse(res);
        this.apiProductsById.clear();
        const mapped = apiProducts.map((product: any) => {
          const productId = String(product?.product_id || '').trim();
          if (productId) {
            this.apiProductsById.set(productId, product);
          }
          const variant = product?.im_ProductVariants?.[0];
          const images = variant?.im_ProductImages || [];
          const imageUrl =
            product?.thumbnail_url ||
            images.find((img: any) => img?.is_primary === 'T')?.image_url ||
            images[0]?.image_url ||
            '/mobile.jpg';

          const display = resolveVariantDisplayPrice(variant, product);
          const reviews = Math.floor(Math.random() * 1000) + 120;
          const rating = Math.floor(Math.random() * 2) + 4;
          const soldCount = `${(Math.random() * 18 + 2).toFixed(1)}K+ sold`;
          const shopFields = this.shopService.mapApiProductShopFields(product, variant);

          return {
            id: product?.product_id,
            slug: String(product?.slug || '').trim() || undefined,
            title: product?.title || 'Untitled Product',
            category: product?.category_name || product?.brand || 'Products',
            brand: product?.brand || 'Brand',
            description: product?.description || '',
            image: imageUrl,
            price: display.price,
            soldLabel: soldCount,
            reviews,
            rating,
            storeName: shopFields.store_name,
            storeId: shopFields.store_id,
            store_id: shopFields.store_id,
            store_name: shopFields.store_name,
            shop_atoll: shopFields.shop_atoll,
            shop_city: shopFields.shop_city,
            shop_location: shopFields.shop_location,
            store_currency_code: display.display_currency || shopFields.store_currency_code,
            store_currency_symbol: display.display_symbol || shopFields.store_currency_symbol,
            featured_item: String(product?.featured_item ?? '').trim(),
          };
        });
        this.allProducts = mapped;
        this.filterProducts();
        this.applySort();
        this.isLoading = false;
        this.cdr.markForCheck();

        this.shopService.enrichWithShopNames(mapped).subscribe({
          next: (enriched) => {
            if (!this.currencyService.isCurrentGeneration(generation)) return;
            this.allProducts = enriched.map((product: any) => ({
              ...product,
              storeName: product.store_name || product.storeName,
            }));
            this.filterProducts();
            this.applySort();
            this.cdr.markForCheck();
          },
          error: () => {
            /* mapped products already shown */
          },
        });
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.allProducts = [];
        this.filteredProducts = [];
        this.visibleCount = this.pageSize;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private filterProducts(): void {
    const term = this.searchQuery.toLowerCase().trim();
    if (!term) {
      this.filteredProducts = [...this.allProducts];
    } else {
      this.filteredProducts = this.allProducts.filter((product: any) => {
        const title = String(product?.title || '').toLowerCase();
        const brand = String(product?.brand || '').toLowerCase();
        const category = String(product?.category || '').toLowerCase();
        const description = String(product?.description || '').toLowerCase();
        return (
          title.includes(term) ||
          brand.includes(term) ||
          category.includes(term) ||
          description.includes(term)
        );
      });
    }
    this.visibleCount = this.pageSize;
    this.applySort();
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
  }

  onSubmitSearch(): void {
    const term = this.searchQuery.trim();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: term || null },
      queryParamsHandling: 'merge',
    });
  }

  toggleSortDropdown(): void {
    this.isSortOpen = !this.isSortOpen;
  }

  selectSort(sortValue: string): void {
    this.sortBy = sortValue;
    this.isSortOpen = false;
    this.applySort();
  }

  get selectedSortLabel(): string {
    const option = this.sortOptions.find((opt) => opt.value === this.sortBy);
    return option ? option.label : 'Featured';
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.onSubmitSearch();
  }

  onBack(): void {
    window.history.back();
  }

  onProductClick(product: any): void {
    const link = buildProductCommands({
      ...product,
      store_id: product?.store_id || product?.storeId,
    });
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  onToggleFavorite(product: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const result = this.favoritesService.toggle({
      id: product?.id,
      name: product?.title || 'Untitled Product',
      price: Number(product?.price) || 0,
      originalPrice: 0,
      image: product?.image || '/mobile.jpg',
      inStock: true,
      store_id: product?.storeId ? String(product.storeId) : undefined,
      rating: product?.rating,
      reviews: product?.reviews,
      brand: product?.brand,
    });
    if (result === 'login_required') return;
    this.actionFeedback.feedback(event, 'favorite', { added: result, image: product?.image });
  }

  isProductFavorite(product: any): boolean {
    return this.favoritesService.isFavorite(product?.id);
  }

  onAddToCart(product: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    const productId = String(product?.id || '').trim();
    if (!productId) return;

    const apiProduct = this.apiProductsById.get(productId);
    if (!apiProduct) {
      this.cartModalApiProduct = {
        product_id: productId,
        title: product?.title || 'Untitled Product',
        thumbnail_url: product?.image || '/mobile.jpg',
        store_id: product?.store_id || product?.storeId,
        store_name: product?.store_name || product?.storeName,
        shop_location: product?.shop_location,
        store_currency_code: product?.store_currency_code,
        store_currency_symbol: product?.store_currency_symbol,
        im_ProductVariants: [
          {
            base_price: Number(product?.price) || 0,
            im_ProductImages: [{ image_url: product?.image || '/mobile.jpg', is_primary: 'T' }],
            im_VariantAttributes: [],
            im_StoreVariantInventory: [{ on_hand_quantity: 1 }],
          },
        ],
      };
    } else {
      this.cartModalApiProduct = {
        ...apiProduct,
        store_currency_code: product?.store_currency_code,
        store_currency_symbol: product?.store_currency_symbol,
      };
    }

    this.cartModalStoreId = String(product?.store_id || product?.storeId || '').trim();
    this.cartModalMode = 'add';
    this.isCartModalOpen = true;
  }

  closeCartModal(): void {
    this.isCartModalOpen = false;
  }

  onCartModalAdded(payload?: { quantity: number; image: string }): void {
    this.isCartModalOpen = false;
    this.selectedCartItem = {
      name: this.cartModalApiProduct?.title || 'Untitled Product',
      image: payload?.image || this.cartModalApiProduct?.thumbnail_url || '/mobile.jpg',
      quantity: payload?.quantity || 1,
      price: Number(this.cartModalApiProduct?.im_ProductVariants?.[0]?.base_price) || 0,
      shipping: 0,
    };
    this.isMobileCartModalOpen = true;
  }

  closeMobileCartModal(): void {
    this.isMobileCartModalOpen = false;
  }

  onSeeInCart(): void {
    this.isMobileCartModalOpen = false;
    this.router.navigate(['/cart']);
  }

  private applySort(): void {
    const products = [...this.filteredProducts];
    switch (this.sortBy) {
      case 'price-low':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        products.sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));
        break;
      default:
        break;
    }
    // Featured matches always float to the top of the current result set.
    this.filteredProducts = this.prioritizeFeaturedProducts(products);
    this.visibleCount = this.pageSize;
  }

  prioritizeFeaturedProducts(products: any[]): any[] {
    const featured: any[] = [];
    const others: any[] = [];
    for (const product of products) {
      if (this.isFeaturedProduct(product)) {
        featured.push(product);
      } else {
        others.push(product);
      }
    }
    return [...featured, ...others];
  }

  isFeaturedProduct(product: any): boolean {
    const flag = String(product?.featured_item || '').trim().toUpperCase();
    return flag === 'T' || flag === 'TRUE' || flag === '1' || flag === 'Y' || flag === 'YES';
  }

  getStarDisplay(rating: number): string {
    const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
  }

  trackByProductId(_: number, product: any): string {
    return String(product?.id || '');
  }
}
