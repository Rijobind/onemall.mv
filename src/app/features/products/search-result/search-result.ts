import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../shared/components/shop-name-link/shop-name-link';
import { FavoritesService } from '../../../core/services/favorites.service/favorites.service';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service/action-feedback.service';
import { Header } from '../../../shared/components/header/header';
import { MobileCart } from '../../../core/models/mobile-cart/mobile-cart';

@Component({
  selector: 'app-search-result',
  imports: [CommonModule, Header, MobileCart, ShopNameLink],
  templateUrl: './search-result.html',
  styleUrl: './search-result.css',
})
export class SearchResult implements OnInit, OnDestroy {
  private readonly cartStorageKey = 'cart_items';
  searchQuery: string = '';
  allProducts: any[] = [];
  filteredProducts: any[] = [];
  isLoading = true;
  isMobileCartModalOpen = false;
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
    private shopService: MarketplaceShopService
  ) {}

  ngOnInit(): void {
    this.startSearchResultAdRotation();
    this.loadProducts();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
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

  private loadProducts(): void {
    this.isLoading = true;
    this.api.getMarketplaceProductsWithFallback(this.regionService.getProductRequestParams()).subscribe({
      next: (res: any) => {
        const apiProducts = this.api.extractProductsFromResponse(res);
        const mapped = apiProducts.map((product: any) => {
          const variant = product?.im_ProductVariants?.[0];
          const images = variant?.im_ProductImages || [];
          const imageUrl =
            product?.thumbnail_url ||
            images.find((img: any) => img?.is_primary === 'T')?.image_url ||
            images[0]?.image_url ||
            '/mobile.jpg';

          const basePrice = Number(variant?.base_price || 0);
          const reviews = Math.floor(Math.random() * 1000) + 120;
          const rating = Math.floor(Math.random() * 2) + 4;
          const soldCount = `${(Math.random() * 18 + 2).toFixed(1)}K+ sold`;
          const shopFields = this.shopService.mapApiProductShopFields(product, variant);

          return {
            id: product?.product_id,
            title: product?.title || 'Untitled Product',
            category: product?.category_name || product?.brand || 'Products',
            brand: product?.brand || 'Brand',
            description: product?.description || '',
            image: imageUrl,
            price: basePrice,
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
          };
        });
        this.shopService.enrichWithShopNames(mapped).subscribe({
          next: (enriched) => {
            this.allProducts = enriched.map((product: any) => ({
              ...product,
              storeName: product.store_name || product.storeName,
            }));
            this.filterProducts();
            this.applySort();
            this.isLoading = false;
          },
          error: () => {
            this.allProducts = mapped;
            this.filterProducts();
            this.applySort();
            this.isLoading = false;
          },
        });
      },
      error: () => {
        this.allProducts = [];
        this.filteredProducts = [];
        this.isLoading = false;
      },
    });
  }

  private filterProducts(): void {
    const term = this.searchQuery.toLowerCase().trim();
    if (!term) {
      this.filteredProducts = [...this.allProducts];
      return;
    }

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
    this.router.navigate(['/product-details'], {
      queryParams: {
        productId: product?.id,
        store_id: product?.storeId || undefined,
      },
    });
  }

  onToggleFavorite(product: any, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    const added = this.favoritesService.toggle({
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
    this.actionFeedback.feedback(event, 'favorite', { added, image: product?.image });
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

    const existingItems = this.getStoredCartItems();
    const existingIndex = existingItems.findIndex(
      (item: any) => String(item?.id || '').trim() === productId
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex].quantity =
        (Number(existingItems[existingIndex].quantity) || 0) + 1;
      existingItems[existingIndex].price = Number(product?.price) || 0;
      existingItems[existingIndex].image = product?.image || '/mobile.jpg';
      existingItems[existingIndex].name = product?.title || 'Untitled Product';
      existingItems[existingIndex].store_id = String(product?.store_id || product?.storeId || '').trim();
      existingItems[existingIndex].store_name = product?.store_name || product?.storeName || '';
      existingItems[existingIndex].shop_location = product?.shop_location || '';
    } else {
      existingItems.push({
        id: productId,
        name: product?.title || 'Untitled Product',
        price: Number(product?.price) || 0,
        image: product?.image || '/mobile.jpg',
        quantity: 1,
        inStock: true,
        store_id: String(product?.store_id || product?.storeId || '').trim(),
        store_name: product?.store_name || product?.storeName || '',
        shop_location: product?.shop_location || '',
      });
    }

    localStorage.setItem(this.cartStorageKey, JSON.stringify(existingItems));
    window.dispatchEvent(new Event('cart-updated'));
    this.actionFeedback.feedback(event, 'cart', { image: product?.image });

    const savedItem = existingItems.find((item: any) => String(item?.id || '').trim() === productId);
    this.selectedCartItem = {
      name: savedItem?.name || product?.title || 'Untitled Product',
      image: savedItem?.image || product?.image || '/mobile.jpg',
      quantity: Number(savedItem?.quantity) || 1,
      price: Number(savedItem?.price) || Number(product?.price) || 0,
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
    this.filteredProducts = products;
  }

  getStarDisplay(rating: number): string {
    const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return `${'★'.repeat(safeRating)}${'☆'.repeat(5 - safeRating)}`;
  }

  trackByProductId(_: number, product: any): string {
    return String(product?.id || '');
  }

  private getStoredCartItems(): any[] {
    const raw = localStorage.getItem(this.cartStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
