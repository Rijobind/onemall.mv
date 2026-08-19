import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { Header } from '../../../../shared/components/header/header';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';
import { buildProductCommands } from '../../../../core/utils/product-url.util';
import {
  CartModel,
  CartModelMode,
} from '../../../products/models/cart-model/cart-model';
import { ProductCardSkeleton } from '../../../../shared/components/product-card-skeleton/product-card-skeleton';

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
  slug?: string;
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
  store_currency_code?: string;
  store_currency_symbol?: string;
  created_at: string;
  featured_item: string;
  inStock: boolean;
}

@Component({
  selector: 'app-categories',
  imports: [CommonModule, Header, ShopNameLink, CartModel, ProductCardSkeleton],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories implements OnInit, OnDestroy {
  private apiProductsById = new Map<string, any>();
  /** First marketplace product image keyed by category / sub / sub-sub id */
  private productImageByCategoryId = new Map<string, string>();

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

  isCartModalOpen = false;
  cartModalMode: CartModelMode = 'add';
  cartModalApiProduct: any = null;
  cartModalStoreId = '';

  private readonly regionUpdatedHandler = () => this.loadProducts();
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.loadProducts(detail?.currency_code);
  };

  constructor(
    private router: Router,
    private api: BackendapiServices,
    private regionService: RegionService,
    private shopService: MarketplaceShopService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
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

  get selectedFeaturedName(): string {
    const selected = this.featuredCategories.find(
      (cat) => cat.id === this.selectedFeaturedCategoryId
    );
    return selected?.name || 'Categories';
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
        this.cdr.markForCheck();
      },
      error: () => {
        this.allCategories = [];
        this.allCategoriesFlat = [];
        this.categoryTree = [];
        this.featuredCategories = [];
        this.shopCategories = [];
        this.selectedFeaturedCategoryId = '';
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadProducts(currencyOverride?: string): void {
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
        apiProducts.forEach((product: any) => {
          const productId = this.normalizeId(product?.product_id ?? product?.id);
          if (productId) this.apiProductsById.set(productId, product);
        });
        const mapped = apiProducts.map((product: any) => this.mapProduct(product));
        this.products = mapped;
        this.rebuildProductImageIndex();
        this.applyDesktopFilters();
        this.cdr.markForCheck();

        this.shopService.enrichWithShopNames(mapped).subscribe({
          next: (enriched) => {
            if (!this.currencyService.isCurrentGeneration(generation)) return;
            this.products = enriched;
            this.rebuildProductImageIndex();
            this.applyDesktopFilters();
            this.cdr.markForCheck();
          },
          error: () => {
            /* mapped products already shown */
          },
        });
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.products = [];
        this.filteredProducts = [];
        this.productImageByCategoryId.clear();
        this.cdr.markForCheck();
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
    const display = resolveVariantDisplayPrice(variant, product);
    const categoryId = this.normalizeId(product?.category_id);
    const subCategoryId = this.normalizeId(product?.sub_category_id);
    const subSubCategoryId = this.normalizeId(product?.sub_sub_category_id);
    const inventory = variant?.im_StoreVariantInventory?.[0];
    const onHandQty = Number(inventory?.on_hand_quantity ?? 0);
    const shopFields = this.shopService.mapApiProductShopFields(product, variant);

    return {
      id: this.normalizeId(product?.product_id ?? product?.id),
      slug: String(product?.slug || '').trim() || undefined,
      name: product?.title || 'Untitled Product',
      price: display.price,
      originalPrice: display.originalPrice,
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
      store_currency_code: display.display_currency || shopFields.store_currency_code,
      store_currency_symbol: display.display_symbol || shopFields.store_currency_symbol,
      created_at: product?.created_at || product?.updated_at || '',
      featured_item: String(product?.featured_item ?? '').trim(),
      inStock: onHandQty > 0,
    };
  }

  private mapCategory(item: any, index: number): CategoryItem {
    const categoryId = this.normalizeId(item?.category_id) || `category-${index}`;
    const parentId = this.normalizeId(item?.parent_id);

    return {
      id: categoryId,
      name: String(item?.category_name || 'Category'),
      parentId,
      // Prefer API category image when set; otherwise resolved from products in getCategoryImage()
      image: this.getFirstValidImage(item),
      hot: this.toBoolean(item?.is_hot) || this.toBoolean(item?.hot),
    };
  }

  /** Image for a category tile: API image_url first, else a product from that category. */
  getCategoryImage(category: CategoryItem): string {
    const apiImage = String(category?.image || '').trim();
    if (apiImage) return apiImage;

    const direct = this.productImageByCategoryId.get(category.id);
    if (direct) return direct;

    const node = this.findCategoryById(category.id, this.categoryTree);
    if (node) {
      for (const id of this.getAllCategoryIds(node)) {
        const childImage = this.productImageByCategoryId.get(id);
        if (childImage) return childImage;
      }
    }

    return '/mobile.jpg';
  }

  private rebuildProductImageIndex(): void {
    this.productImageByCategoryId.clear();
    for (const product of this.products) {
      const image = String(product?.image || '').trim();
      if (!image || image === '/mobile.jpg') continue;

      for (const id of [
        product.category_id,
        product.sub_category_id,
        product.sub_sub_category_id,
      ]) {
        if (id && !this.productImageByCategoryId.has(id)) {
          this.productImageByCategoryId.set(id, image);
        }
      }
    }
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
    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  onAddToCart(product: CategoryProduct, event: MouseEvent): void {
    event.stopPropagation();
    const productId = this.normalizeId(product.id);
    if (!productId) return;

    const apiProduct = this.apiProductsById.get(productId);
    if (!apiProduct) {
      this.cartModalApiProduct = {
        product_id: productId,
        title: product?.name || 'Untitled Product',
        thumbnail_url: product?.image || '/mobile.jpg',
        store_id: product?.store_id,
        store_name: product?.store_name,
        shop_location: product?.shop_location,
        store_currency_code: product?.store_currency_code,
        store_currency_symbol: product?.store_currency_symbol,
        im_ProductVariants: [
          {
            base_price: Number(product?.price) || 0,
            im_ProductImages: [{ image_url: product?.image || '/mobile.jpg', is_primary: 'T' }],
            im_VariantAttributes: [],
            im_StoreVariantInventory: [{ on_hand_quantity: product?.inStock === false ? 0 : 1 }],
          },
        ],
      };
    } else {
      this.cartModalApiProduct = {
        ...apiProduct,
        store_currency_code: product?.store_currency_code,
        store_currency_symbol: product?.store_currency_symbol,
        store_name: product?.store_name || apiProduct?.store_name,
        shop_location: product?.shop_location || apiProduct?.shop_location,
      };
    }

    this.cartModalStoreId = this.normalizeId(product?.store_id);
    this.cartModalMode = 'add';
    this.isCartModalOpen = true;
  }

  closeCartModal(): void {
    this.isCartModalOpen = false;
  }

  onCartModalAdded(): void {
    this.isCartModalOpen = false;
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
