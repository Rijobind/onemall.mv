import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service/action-feedback.service';
import { Header } from '../../../../shared/components/header/header';

type CategoryFilter = 'all' | string;

interface CategoryItem {
  id: string;
  name: string;
  image: string;
  parentId?: string | null;
  hot?: boolean;
}

interface CategoryProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews: number;
  image: string;
  category: string;
  category_id: string;
  sub_category_id: string;
  sub_sub_category_id: string;
  store_id: string;
  store_name: string;
  shop_atoll: string;
  shop_city: string;
  shop_location: string;
  created_at: string;
  featured_item: string;
  inStock: boolean;
}

@Component({
  selector: 'app-categories',
  imports: [CommonModule, Header, ShopNameLink],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories implements OnInit, OnDestroy {
  private readonly cartStorageKey = 'cart_items';
  private readonly fallbackImages = [
    '/Categories1.jpg',
    '/Categories2.jpg',
    '/Categories3.jpg',
    '/Categories4.jpg',
    '/Categories5.jpg',
    '/Categories6.jpg',
    '/Categories7.jpg',
    '/Categories8.jpg',
    '/Categories9.jpg',
    '/Categories10.jpg',
    '/Categories11.jpg',
    '/Categories12.jpg',
  ];

  allCategories: CategoryItem[] = [];
  allCategoriesFlat: any[] = [];
  categoryTree: any[] = [];
  featuredCategories: CategoryItem[] = [];
  shopCategories: CategoryItem[] = [];
  selectedFeaturedCategoryId = '';
  isLoading = true;

  products: CategoryProduct[] = [];
  filteredProducts: CategoryProduct[] = [];
  selectedFilter: CategoryFilter = 'all';
  selectedCategory: any = null;
  currentPage = 1;
  readonly pageSize = 8;
  private readonly regionUpdatedHandler = () => this.loadProducts();

  constructor(
    private router: Router,
    private api: BackendapiServices,
    private actionFeedback: ActionFeedbackService,
    private regionService: RegionService,
    private shopService: MarketplaceShopService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
    }
  }

  get paginatedProducts(): CategoryProduct[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set<number>([1, total, this.currentPage]);
    if (this.currentPage > 1) pages.add(this.currentPage - 1);
    if (this.currentPage < total) pages.add(this.currentPage + 1);
    if (this.currentPage <= 3) {
      pages.add(2);
      pages.add(3);
    }
    if (this.currentPage >= total - 2) {
      pages.add(total - 1);
      pages.add(total - 2);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }

  get showPageEllipsis(): boolean {
    return this.totalPages > 7;
  }

  private loadCategories(): void {
    this.isLoading = true;
    this.api.getAllCategoryList().subscribe({
      next: (res: any) => {
        const apiCategories = Array.isArray(res?.data) ? res.data : [];
        this.allCategoriesFlat = apiCategories;
        this.allCategories = apiCategories.map((item: any, index: number) =>
          this.mapCategory(item, index)
        );

        const parents = apiCategories.filter((cat: any) => {
          const parentId = cat?.parent_id;
          return parentId == null || String(parentId).trim() === '';
        });
        this.categoryTree = parents.map((parent: any) =>
          this.buildCategoryTree(parent, apiCategories)
        );

        this.featuredCategories = this.allCategories.filter((cat) => !cat.parentId);

        if (this.featuredCategories.length > 0) {
          this.selectedFeaturedCategoryId = this.featuredCategories[0].id;
          this.setShopCategories(this.selectedFeaturedCategoryId);
        } else {
          this.selectedFeaturedCategoryId = '';
          this.shopCategories = [];
        }

        this.applyDesktopFilters();
        this.isLoading = false;
      },
      error: () => {
        this.allCategories = [];
        this.allCategoriesFlat = [];
        this.categoryTree = [];
        this.featuredCategories = [];
        this.shopCategories = [];
        this.selectedFeaturedCategoryId = '';
        this.isLoading = false;
      },
    });
  }

  private loadProducts(): void {
    this.api.getMarketplaceProductsWithFallback(this.regionService.getProductRequestParams()).subscribe({
      next: (res: any) => {
        const apiProducts = this.api.extractProductsFromResponse(res);
        const mapped = apiProducts.map((product: any) => this.mapProduct(product));
        this.shopService.enrichWithShopNames(mapped).subscribe({
          next: (enriched) => {
            this.products = enriched;
            this.applyDesktopFilters();
          },
          error: () => {
            this.products = mapped;
            this.applyDesktopFilters();
          },
        });
      },
      error: () => {
        this.products = [];
        this.filteredProducts = [];
      },
    });
  }

  private mapProduct(product: any): CategoryProduct {
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
    const inventory = variant?.im_StoreVariantInventory?.[0];
    const onHandQty = Number(inventory?.on_hand_quantity ?? 0);
    const shopFields = this.shopService.mapApiProductShopFields(product, variant);

    return {
      id: this.normalizeId(product?.product_id ?? product?.id),
      name: product?.title || 'Untitled Product',
      price: basePrice,
      originalPrice: basePrice > 0 ? Math.round(basePrice * 1.2 * 100) / 100 : 0,
      rating: 4.5 + Math.random() * 0.5,
      reviews: Math.floor(Math.random() * 5000) + 100,
      image: imageUrl,
      category: this.resolveCategoryName(categoryId, subCategoryId, subSubCategoryId),
      category_id: categoryId,
      sub_category_id: subCategoryId,
      sub_sub_category_id: subSubCategoryId,
      store_id: shopFields.store_id,
      store_name: shopFields.store_name,
      shop_atoll: shopFields.shop_atoll,
      shop_city: shopFields.shop_city,
      shop_location: shopFields.shop_location,
      created_at: product?.created_at || product?.updated_at || '',
      featured_item: String(product?.featured_item ?? '').trim(),
      inStock: onHandQty > 0,
    };
  }

  private mapCategory(item: any, index: number): CategoryItem {
    const imageCandidate = this.getFirstValidImage(item);
    const categoryId = this.normalizeId(item?.category_id) || `category-${index}`;
    const parentId = this.normalizeId(item?.parent_id);

    return {
      id: categoryId,
      name: String(item?.category_name || 'Category'),
      parentId,
      image: imageCandidate || this.fallbackImages[index % this.fallbackImages.length] || '/mobile.jpg',
      hot: this.toBoolean(item?.is_hot) || this.toBoolean(item?.hot),
    };
  }

  private buildCategoryTree(parent: any, allCategories: any[]): any {
    const children = allCategories.filter(
      (cat: any) => this.normalizeId(cat.parent_id) === this.normalizeId(parent.category_id)
    );
    return {
      ...parent,
      children: children.map((child: any) => this.buildCategoryTree(child, allCategories)),
    };
  }

  private getFirstValidImage(item: any): string {
    const candidates = [
      item?.image,
      item?.image_url,
      item?.category_image,
      item?.thumbnail,
      item?.thumbnail_url,
      item?.icon,
      item?.icon_url,
    ];
    const first = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return first ? String(first) : '';
  }

  private normalizeId(value: any): string {
    if (value === null || value === undefined) return '';
    const normalized = String(value).trim();
    if (!normalized || normalized.toLowerCase() === 'null') return '';
    return normalized;
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes';
  }

  private setShopCategories(parentId: string): void {
    const directChildren = this.allCategories.filter((cat) => cat.parentId === parentId);
    this.shopCategories = directChildren.length > 0 ? directChildren : this.allCategories;
  }

  private resolveCategoryName(
    categoryId: string,
    subCategoryId: string,
    subSubCategoryId: string
  ): string {
    const ids = [subSubCategoryId, subCategoryId, categoryId].filter(Boolean);
    for (const id of ids) {
      const match = this.allCategoriesFlat.find(
        (cat: any) => this.normalizeId(cat.category_id) === id
      );
      if (match?.category_name) {
        return String(match.category_name).trim();
      }
    }
    return 'Other';
  }

  private applyDesktopFilters(): void {
    let result = [...this.products];

    if (this.selectedFilter !== 'all') {
      const category = this.findCategoryById(this.selectedFilter, this.categoryTree);
      if (category) {
        const categoryIds = new Set(this.getAllCategoryIds(category));
        result = result.filter((product) => this.productMatchesCategoryIds(product, categoryIds));
      }
    }

    this.filteredProducts = result;
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  private findCategoryById(categoryId: string, tree: any[]): any | null {
    for (const cat of tree) {
      if (this.normalizeId(cat.category_id) === this.normalizeId(categoryId)) {
        return cat;
      }
      if (cat.children?.length) {
        const found = this.findCategoryById(categoryId, cat.children);
        if (found) return found;
      }
    }
    return null;
  }

  private getAllCategoryIds(category: any): string[] {
    const ids = [this.normalizeId(category.category_id)];
    (category.children || []).forEach((child: any) => {
      ids.push(...this.getAllCategoryIds(child));
    });
    return ids.filter(Boolean);
  }

  private productMatchesCategoryIds(product: CategoryProduct, categoryIds: Set<string>): boolean {
    return (
      categoryIds.has(product.category_id) ||
      categoryIds.has(product.sub_category_id) ||
      categoryIds.has(product.sub_sub_category_id)
    );
  }

  onSelectFeaturedCategory(category: CategoryItem): void {
    this.selectedFeaturedCategoryId = category.id;
    this.setShopCategories(category.id);
  }

  onSelectCategory(category: CategoryItem): void {
    this.router.navigate(['/product-list'], {
      queryParams: {
        categoryId: category.id,
        categoryName: category.name,
      },
    });
  }

  onDesktopSelectAllProducts(): void {
    this.selectedFilter = 'all';
    this.selectedCategory = null;
    this.currentPage = 1;
    this.applyDesktopFilters();
  }

  onDesktopSelectCategory(category: any): void {
    this.selectedFilter = this.normalizeId(category.category_id);
    this.selectedCategory = category;
    this.currentPage = 1;
    this.applyDesktopFilters();
  }

  isCategorySelected(category: any): boolean {
    if (!category || this.selectedFilter === 'all') {
      return false;
    }
    return this.normalizeId(category.category_id) === this.normalizeId(this.selectedFilter);
  }

  isDesktopCategoryActive(category: any): boolean {
    return this.isCategorySelected(category);
  }

  isDesktopAllProductsActive(): boolean {
    return this.selectedFilter === 'all';
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  onPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  onNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  formatReviews(count: number): string {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k Reviews`;
    }
    return `${count.toLocaleString()} Reviews`;
  }

  formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  getDiscountPercentage(product: CategoryProduct): number {
    if (!product.originalPrice || product.originalPrice <= product.price) return 0;
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  }

  getDesktopResultsLabel(): string {
    if (this.selectedCategory?.category_name) return this.selectedCategory.category_name;
    return 'All Products';
  }

  onProductClick(product: CategoryProduct): void {
    this.router.navigate(['/product-details'], {
      queryParams: {
        productId: product.id,
        store_id: product.store_id || undefined,
      },
    });
  }

  onAddToCart(product: CategoryProduct, event: MouseEvent): void {
    event.stopPropagation();
    const productId = this.normalizeId(product.id);
    if (!productId) return;

    const existingItems = this.getStoredCartItems();
    const existingIndex = existingItems.findIndex(
      (item: any) => this.normalizeId(item?.id) === productId
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex].quantity =
        (Number(existingItems[existingIndex].quantity) || 0) + 1;
      existingItems[existingIndex].store_id = product.store_id || '';
      existingItems[existingIndex].store_name = product.store_name || '';
      existingItems[existingIndex].shop_location = product.shop_location || '';
    } else {
      existingItems.push({
        id: productId,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        quantity: 1,
        inStock: product.inStock,
        store_id: product.store_id || '',
        store_name: product.store_name || '',
        shop_location: product.shop_location || '',
      });
    }

    localStorage.setItem(this.cartStorageKey, JSON.stringify(existingItems));
    window.dispatchEvent(new Event('cart-updated'));
    this.actionFeedback.feedback(event, 'cart', { image: product.image });
  }

  onBuyNow(product: CategoryProduct, event: MouseEvent): void {
    event.stopPropagation();
    this.onAddToCart(product, event);
    this.router.navigate(['/cart']);
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

  trackByCategoryName(_: number, category: CategoryItem): string {
    return category.id;
  }

  trackByProductId(_: number, product: CategoryProduct): string {
    return product.id;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.src = '/mobile.jpg';
  }
}
