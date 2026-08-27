import { ChangeDetectorRef, Component, OnDestroy, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { FavoritesService } from '../../../../core/services/favorites.service/favorites.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service/action-feedback.service';
import { CartModel, CartModelMode } from '../../models/cart-model/cart-model';
import { ProductCardSkeleton } from '../../../../shared/components/product-card-skeleton/product-card-skeleton';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';
import { buildProductCommands } from '../../../../core/utils/product-url.util';
import {
  MarketplaceAd,
  MarketplaceAdsService,
} from '../../../../core/services/marketplace-ads.service/marketplace-ads.service';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, Header, Footer, ShopNameLink, CartModel, ProductCardSkeleton],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export class ProductList implements OnInit, OnDestroy {
  private apiProductsById = new Map<string, any>();
  categoryTree: any[] = [];
  allCategories: any[] = [];
  activeChildMap: Map<string, any> = new Map();
  products: any[] = [];
  filteredProducts: any[] = [];
  selectedCategory: any = null;
  categoryBreadcrumb: any[] = []; // [parent, child, grandchild]
  displayedCategoryTree: any[] = []; // Categories to show in sidebar
  sortBy: string = 'featured';
  isSortOpen: boolean = false;
  isLoading: boolean = true;
  readonly pageSize = 36;
  visibleCount = 36;
  hoveredProductId: string | null = null;
  isCartModalOpen = false;
  cartModalMode: CartModelMode = 'add';
  cartModalApiProduct: any = null;
  cartModalStoreId = '';
  private pendingCategoryId: string | null = null;
  private searchTerm: string = '';
  private featuredOnly: boolean = false;
  private newArrivalsOnly: boolean = false;
  browseType: string = '';
  listingMode: 'search' | 'browse' = 'browse';
  mobileSecondCategories: any[] = [];
  readonly mobileAllCategoryOption = { category_id: 'all', category_name: 'All' };
  mobileShopTypes: Array<{ label: string; value: string }> = [
    { label: 'All', value: 'all' },
    { label: 'Men', value: 'men' },
    { label: 'Sports', value: 'sports' },
    { label: 'Women', value: 'women' },
    { label: 'Bags', value: 'bags' },
    { label: 'Jewelry', value: 'jewelry' },
    { label: 'Toy', value: 'toy' },
    { label: 'Home', value: 'home' },
    { label: 'Kids', value: 'kids' },
    { label: 'Industrial', value: 'industrial' },
    { label: 'Electronics', value: 'electronics' },
    { label: 'Crafts', value: 'crafts' },
    { label: 'Beauty', value: 'beauty' },
    { label: 'Baby', value: 'baby' },
    { label: 'Health', value: 'health' },
    { label: 'Household', value: 'household' },
    { label: 'Pets', value: 'pets' },
    { label: 'Musical', value: 'musical' },
    { label: 'Appliances', value: 'appliances' },
    { label: 'Food', value: 'food' },
    { label: 'Books', value: 'books' },
  ];

  sortOptions = [
    { label: 'Featured', value: 'featured' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Newest Arrivals', value: 'newest' },
  ];

  productListAds: MarketplaceAd[] = [];
  currentProductListAdIndex = 0;
  productListAdFading = false;
  private productListAdInterval: ReturnType<typeof setInterval> | null = null;
  private productListAdFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly regionUpdatedHandler = () => this.loadProducts();
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.loadProducts(detail?.currency_code);
  };

  get currentProductListAd(): MarketplaceAd | null {
    return this.productListAds[this.currentProductListAdIndex] || null;
  }

  get currentProductListAdDesktop(): string {
    const ad = this.currentProductListAd;
    return ad ? this.ads.desktopImage(ad) : '';
  }

  get currentProductListAdMobile(): string {
    const ad = this.currentProductListAd;
    return ad ? this.ads.mobileImage(ad) : '';
  }

  private get productListAdCount(): number {
    return this.productListAds.length;
  }

  constructor(
    private api: BackendapiServices,
    private router: Router,
    private route: ActivatedRoute,
    private favoritesService: FavoritesService,
    private actionFeedback: ActionFeedbackService,
    private regionService: RegionService,
    private shopService: MarketplaceShopService,
    private currencyService: CurrencyService,
    private ads: MarketplaceAdsService,
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
    this.loadProductListAds();
    this.route.queryParams.subscribe((params) => {
      const categoryId = params['categoryId'] || params['category_id'];
      const requestedMode = String(params['mode'] || '').toLowerCase();
      this.listingMode = requestedMode === 'browse' ? 'browse' : 'search';
      this.searchTerm = (params['search'] || '').toString().trim().toLowerCase();
      this.browseType = (params['type'] || '').toString().trim().toLowerCase();
      this.featuredOnly = this.isTruthyFlag(params['featured']);
      this.newArrivalsOnly = this.isTruthyFlag(params['new_arrivals']);

      if (!categoryId) {
        this.pendingCategoryId = null;
        this.selectedCategory = null;
        this.categoryBreadcrumb = [];
        this.displayedCategoryTree = this.categoryTree;
        this.applyFiltersFromState();
        return;
      }

      this.pendingCategoryId = this.normalizeId(categoryId);
      this.tryApplyPendingCategoryFilter();
    });

    this.loadCategory();
    this.loadProducts();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
      window.addEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  ngOnDestroy(): void {
    this.stopProductListAdRotation();
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
      window.removeEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  private loadProductListAds(): void {
    this.ads.getAdsBySlot('listing_banner').subscribe((ads) => {
      this.productListAds = ads;
      this.currentProductListAdIndex = 0;
      this.startProductListAdRotation();
      this.cdr.detectChanges();
    });
  }

  private startProductListAdRotation(): void {
    this.stopProductListAdRotation();
    if (this.productListAdCount <= 1) return;
    this.productListAdInterval = setInterval(() => {
      this.productListAdFading = true;
      this.productListAdFadeTimer = setTimeout(() => {
        this.currentProductListAdIndex =
          (this.currentProductListAdIndex + 1) % this.productListAdCount;
        this.productListAdFading = false;
      }, 550);
    }, 5200);
  }

  private stopProductListAdRotation(): void {
    if (this.productListAdInterval) {
      clearInterval(this.productListAdInterval);
      this.productListAdInterval = null;
    }
    if (this.productListAdFadeTimer) {
      clearTimeout(this.productListAdFadeTimer);
      this.productListAdFadeTimer = null;
    }
  }

  onProductListAdClick(): void {
    const ad = this.currentProductListAd;
    if (ad) {
      this.ads.openShopLink(ad);
    }
  }

  private normalizeId(value: any): string {
    return value == null ? '' : String(value);
  }

  private toSafeNumber(value: any, fallback: number = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private isVideoMedia(url: string | null | undefined): boolean {
    if (!url) return false;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  }

  private resolveStoreIdFromProduct(product: any, variant: any): string {
    const candidate =
      product?.store_id ??
      product?.storeId ??
      variant?.store_id ??
      variant?.storeId ??
      variant?.im_StoreVariantInventory?.[0]?.store_id ??
      variant?.im_StoreVariantInventory?.[0]?.storeId ??
      '';
    return this.normalizeId(candidate);
  }

  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      this.allCategories = res.data || [];
      const parents = this.allCategories.filter((cat: any) => cat.parent_id == null);
      this.categoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, this.allCategories));
      this.displayedCategoryTree = this.categoryTree; // Initialize with all categories
      this.mobileSecondCategories = this.buildMobileSecondCategories();

      this.tryApplyPendingCategoryFilter();
      this.refreshMobileSecondCategories();
      this.cdr.markForCheck();
    });
  }

  private refreshMobileSecondCategories(): void {
    if (!this.allCategories.length) {
      return;
    }
    this.mobileSecondCategories = this.buildMobileSecondCategories();
  }

  loadProducts(currencyOverride?: string) {
    this.isLoading = true;
    this.cdr.markForCheck();
    const generation = this.currencyService.fetchGeneration;
    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );
    this.api.getMarketplaceProductsWithFallback(params).subscribe(
      (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const apiProducts = this.api.extractProductsFromResponse(res);
        this.apiProductsById.clear();
        
        // Transform API product data to match template structure
        const mapped = apiProducts.map((product: any) => {
          const productId = this.normalizeId(product.product_id);
          if (productId) {
            this.apiProductsById.set(productId, product);
          }
          const variant = product.im_ProductVariants?.[0];
          const images = variant?.im_ProductImages || [];
          const mediaUrls = images
            .map((img: any) => img?.image_url)
            .filter((url: string | undefined) => !!url);
          const firstVideo = mediaUrls.find((url: string) => this.isVideoMedia(url)) || null;
          const firstImage = mediaUrls.find((url: string) => !this.isVideoMedia(url)) || null;
          const inventory = variant?.im_StoreVariantInventory?.[0];
          const onHandQty = this.toSafeNumber(inventory?.on_hand_quantity, 0);
          const display = resolveVariantDisplayPrice(variant, product);
          const shopFields = this.shopService.mapApiProductShopFields(product, variant);
          
          return {
            id: product.product_id,
            slug: String(product?.slug || '').trim() || undefined,
            name: product.title || 'Untitled Product',
            price: display.price,
            originalPrice: display.originalPrice,
            rating: 4.5,
            reviews: Math.floor(Math.random() * 5000) + 100,
            image: product.thumbnail_url || firstImage || firstVideo || '/mobile.jpg',
            video: firstVideo,
            category_id: this.normalizeId(product.category_id),
            sub_category_id: this.normalizeId(product.sub_category_id),
            sub_sub_category_id: this.normalizeId(product.sub_sub_category_id),
            store_id: shopFields.store_id,
            store_name: shopFields.store_name,
            shop_atoll: shopFields.shop_atoll,
            shop_city: shopFields.shop_city,
            shop_location: shopFields.shop_location,
            store_currency_code: display.display_currency || shopFields.store_currency_code,
            store_currency_symbol: display.display_symbol || shopFields.store_currency_symbol,
            description: product.description,
            brand: product.brand,
            created_at: product?.created_at || '',
            updated_at: product?.updated_at || '',
            inStock: onHandQty > 0,
            delivery: 'FREE delivery',
            offer: 'Up to 5% back',
            stock: onHandQty > 0 && onHandQty < 10 
              ? `Only ${onHandQty} left in stock` 
              : null,
            featured_item: String(product?.featured_item ?? '').trim(),
          };
        });

        this.products = mapped;
        this.finishProductsLoad();

        this.shopService.enrichWithShopNames(mapped).subscribe({
          next: (enriched) => {
            if (!this.currencyService.isCurrentGeneration(generation)) return;
            this.products = enriched;
            this.applyFiltersFromState();
            this.cdr.markForCheck();
          },
          error: () => {
            /* mapped products already shown */
          },
        });
      },
      () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.products = [];
        this.filteredProducts = [];
        this.visibleCount = this.pageSize;
        this.isLoading = false;
        this.refreshMobileSecondCategories();
        this.cdr.markForCheck();
      }
    );
  }

  private finishProductsLoad(): void {
    this.applyFiltersFromState();
    this.tryApplyPendingCategoryFilter();
    this.isLoading = false;
    this.refreshMobileSecondCategories();
    this.cdr.markForCheck();
  }

  buildCategoryTree(parent: any, allCategories: any[]): any {
    const children = allCategories.filter(
      (cat: any) => this.normalizeId(cat.parent_id) === this.normalizeId(parent.category_id)
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

  selectCategoryById(categoryId: string) {
    // Find category in the flat list first
    const normalizedCategoryId = this.normalizeId(categoryId);
    const category = this.allCategories.find(
      (cat: any) => this.normalizeId(cat.category_id) === normalizedCategoryId
    );
    if (category) {
      // Rebuild the category with children from tree
      const categoryWithChildren = this.findCategoryById(categoryId, this.categoryTree);
      if (categoryWithChildren) {
        this.onCategoryClick(categoryWithChildren, false);
      } else {
        // If not found in tree, use the flat category
        this.onCategoryClick(category, false);
      }
      return;
    }

    // Fallback: apply direct product filter even if category tree lookup misses.
    this.selectedCategory = null;
    this.categoryBreadcrumb = [];
    this.displayedCategoryTree = this.categoryTree;
    this.applyFiltersFromState();
  }

  findCategoryById(categoryId: string, tree: any[]): any {
    for (const cat of tree) {
      if (this.normalizeId(cat.category_id) === this.normalizeId(categoryId)) {
        return cat;
      }
      if (cat.children && cat.children.length > 0) {
        const found = this.findCategoryById(categoryId, cat.children);
        if (found) return found;
      }
    }
    return null;
  }

  buildCategoryBreadcrumb(category: any): any[] {
    if (!category) return [];
    
    const breadcrumb: any[] = [];
    
    // Recursively find all parents
    const findParents = (cat: any): any[] => {
      if (!cat || !cat.parent_id) {
        return [];
      }
      
      const parent = this.allCategories.find(
        (c: any) => this.normalizeId(c.category_id) === this.normalizeId(cat.parent_id)
      );
      if (parent) {
        return [...findParents(parent), parent];
      }
      return [];
    };
    
    // Build breadcrumb: [parent, child, grandchild]
    const parents = findParents(category);
    breadcrumb.push(...parents);
    breadcrumb.push(category);
    
    return breadcrumb;
  }

  onCategoryClick(category: any, updateUrl: boolean = true) {
    this.selectedCategory = category;
    this.categoryBreadcrumb = this.buildCategoryBreadcrumb(category);
    
    // Find the parent category and set displayed category tree
    this.updateDisplayedCategoryTree(category);
    
    this.applyFiltersFromState();
    
    // Update URL without navigation
    if (updateUrl) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          categoryId: category.category_id,
          category_id: category.category_id,
          categoryName: category.category_name,
        },
        queryParamsHandling: 'merge',
      });
    }
  }

  // Update displayed category tree based on selected category
  updateDisplayedCategoryTree(selectedCategory: any) {
    if (!selectedCategory) {
      this.displayedCategoryTree = this.categoryTree;
      return;
    }

    // Find the root parent of the selected category
    const parentCategory = this.findParentCategory(selectedCategory);
    
    if (parentCategory) {
      // Show only the parent category with all its children
      this.displayedCategoryTree = [parentCategory];
    } else {
      // If it's already a parent, show it with all its children
      this.displayedCategoryTree = [selectedCategory];
    }
  }

  // Find the root parent category of a given category
  findParentCategory(category: any): any {
    if (!category || !category.parent_id) {
      // This is a root category
      return this.findCategoryById(category.category_id, this.categoryTree);
    }

    // Find the parent in allCategories
    const parent = this.allCategories.find(
      (cat: any) => this.normalizeId(cat.category_id) === this.normalizeId(category.parent_id)
    );
    
    if (parent && parent.parent_id) {
      // Parent also has a parent, recurse
      return this.findParentCategory(parent);
    } else if (parent) {
      // Found root parent
      return this.findCategoryById(parent.category_id, this.categoryTree);
    }
    
    return null;
  }

  // Get all category IDs including the category itself and all its children
  getAllCategoryIds(category: any): string[] {
    const selectedId = this.normalizeId(category?.category_id);
    if (!selectedId) return [];

    const ids = new Set<string>();

    // Include selected category + all descendants.
    const addDescendants = (categoryId: string) => {
      if (!categoryId || ids.has(categoryId)) return;
      ids.add(categoryId);
      const children = this.allCategories.filter(
        (cat: any) => this.normalizeId(cat.parent_id) === categoryId
      );
      children.forEach((child: any) =>
        addDescendants(this.normalizeId(child.category_id))
      );
    };

    // Include ancestors as well, so leaf selections still match products
    // that are stored at parent category levels.
    const addAncestors = (categoryId: string) => {
      if (!categoryId) return;
      const current = this.allCategories.find(
        (cat: any) => this.normalizeId(cat.category_id) === categoryId
      );
      const parentId = this.normalizeId(current?.parent_id);
      if (!parentId || ids.has(parentId)) return;
      ids.add(parentId);
      addAncestors(parentId);
    };

    addDescendants(selectedId);
    addAncestors(selectedId);

    return Array.from(ids);
  }

  // Get the selected category id plus all of its descendant ids ONLY (no ancestors).
  // Used to detect products that belong specifically to the chosen sub category so
  // they can be prioritized at the top of the list.
  private getCategoryAndDescendantIds(category: any): string[] {
    const selectedId = this.normalizeId(category?.category_id);
    if (!selectedId) return [];

    const ids = new Set<string>();
    const addDescendants = (categoryId: string) => {
      if (!categoryId || ids.has(categoryId)) return;
      ids.add(categoryId);
      const children = this.allCategories.filter(
        (cat: any) => this.normalizeId(cat.parent_id) === categoryId
      );
      children.forEach((child: any) =>
        addDescendants(this.normalizeId(child.category_id))
      );
    };

    addDescendants(selectedId);
    return Array.from(ids);
  }

  isCategorySelected(category: any): boolean {
    if (!this.selectedCategory) return false;
    
    // Check if this category is the selected category or is in the breadcrumb
    return (
      this.selectedCategory.category_id === category.category_id ||
      this.categoryBreadcrumb.some(
        (crumb: any) => crumb.category_id === category.category_id
      )
    );
  }

  onViewAllCategories() {
    this.selectedCategory = null;
    this.categoryBreadcrumb = [];
    this.pendingCategoryId = null;
    this.displayedCategoryTree = this.categoryTree; // Reset to show all categories
    this.applyFiltersFromState();
    
    // Clear category from URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  toggleSortDropdown() {
    this.isSortOpen = !this.isSortOpen;
  }

  selectSort(sortValue: string) {
    this.sortBy = sortValue;
    this.isSortOpen = false;
    this.applySort();
  }

  get selectedSortLabel() {
    const option = this.sortOptions.find((opt) => opt.value === this.sortBy);
    return option ? option.label : 'Featured';
  }

  get selectedBrowseTypeLabel(): string {
    if (!this.browseType || this.browseType === 'all') {
      return 'All';
    }
    const item = this.mobileShopTypes.find((type) => type.value === this.browseType);
    return item?.label || this.browseType;
  }

  isBrowseTypeActive(value: string): boolean {
    const current = this.browseType || 'all';
    return current === value;
  }

  buildMobileSecondCategories(): any[] {
    const secondLevel = this.collectSecondLevelCategories();
    const withProducts = secondLevel.filter((category) =>
      this.categoryHasProducts(category)
    );
    return [this.mobileAllCategoryOption, ...withProducts];
  }

  private collectSecondLevelCategories(): any[] {
    const secondLevel: any[] = [];
    this.categoryTree.forEach((parent: any) => {
      (parent.children || []).forEach((child: any) => secondLevel.push(child));
    });

    if (secondLevel.length) {
      return secondLevel;
    }

    const rootIds = new Set(
      this.allCategories
        .filter((cat: any) => {
          const parentId = cat?.parent_id;
          return parentId == null || String(parentId).trim() === '';
        })
        .map((cat: any) => this.normalizeId(cat.category_id))
    );

    return this.allCategories.filter((cat: any) =>
      rootIds.has(this.normalizeId(cat.parent_id))
    );
  }

  private categoryHasProducts(category: any): boolean {
    if (!this.products.length) {
      return false;
    }

    const categoryIds = new Set(this.getAllCategoryIds(category));
    return this.products.some((product) =>
      this.productMatchesCategoryIds(product, categoryIds)
    );
  }

  onMobileSecondCategoryClick(category: any) {
    if (this.normalizeId(category?.category_id) === 'all') {
      this.onViewAllCategories();
      return;
    }

    if (!category?.category_id) {
      return;
    }

    this.onCategoryClick(category);
  }

  isMobileSecondCategoryActive(category: any): boolean {
    const categoryId = this.normalizeId(category?.category_id);
    if (categoryId === 'all') {
      return !this.selectedCategory;
    }
    return (
      this.normalizeId(this.selectedCategory?.category_id) === categoryId
    );
  }

  onBrowseTypeClick(type: { label: string; value: string }) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mode: 'browse',
        type: type.value,
      },
      queryParamsHandling: 'merge',
    });
  }

  applySort() {
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
        products.sort((a, b) => this.getProductTimestamp(b) - this.getProductTimestamp(a));
        break;
      default:
        // Featured - keep original order, then pin featured items to the top
        break;
    }
    // Featured matches always float to the top of the current result set.
    this.filteredProducts = this.prioritizeFeaturedProducts(products);
    this.visibleCount = this.pageSize;
  }

  private prioritizeFeaturedProducts(products: any[]): any[] {
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

  private applyCategoryFilter(category: any) {
    this.filteredProducts = this.filterProductsByCategoryWithChildPriority(this.products, category);
    this.applySort();
  }

  private filterProductsByCategoryWithChildPriority(products: any[], category: any): any[] {
    const rootParent = this.findRootParentCategory(category);
    const isSecondLevelSelection =
      !!rootParent &&
      this.normalizeId(rootParent.category_id) !== this.normalizeId(category.category_id);

    if (isSecondLevelSelection && rootParent) {
      const parentCategoryIds = new Set(this.getAllCategoryIds(rootParent));
      const parentProducts = products.filter((product: any) =>
        this.productMatchesCategoryIds(product, parentCategoryIds)
      );

      const childProducts = this.resolvePriorityProducts(
        category,
        rootParent,
        parentProducts
      );
      const childProductIds = new Set(
        childProducts.map((product: any) => this.normalizeId(product.id))
      );
      const remainingProducts = parentProducts.filter(
        (product: any) => !childProductIds.has(this.normalizeId(product.id))
      );
      return [...childProducts, ...remainingProducts];
    }

    const categoryIds = new Set(this.getAllCategoryIds(category));
    return products.filter((product: any) =>
      this.productMatchesCategoryIds(product, categoryIds)
    );
  }

  // Resolve which products should be prioritized (shown first) for the selected category.
  // Strategy, starting from the selected category and walking up toward — but never
  // including — the root parent:
  //   1. Products whose category ids match the node (or its descendants).
  //   2. If none match by id, products whose NAME matches the category name. This is
  //      required because many sub-sub category products are only tagged at the parent
  //      level (e.g. every Sportswear product carries sub_sub_category_id = Sportswear),
  //      so "Jersey" vs "Jackets" can only be told apart by the product title.
  // The first level that yields matches wins, so a leaf selection stays specific and
  // does not pull in unrelated sibling products.
  private resolvePriorityProducts(
    category: any,
    rootParent: any,
    scopedProducts: any[]
  ): any[] {
    const rootId = this.normalizeId(rootParent?.category_id);
    let node: any = category;

    while (node && this.normalizeId(node.category_id) !== rootId) {
      const ids = new Set(this.getCategoryAndDescendantIds(node));
      const idMatches = scopedProducts.filter((product) =>
        this.productMatchesCategoryIds(product, ids)
      );
      if (idMatches.length) {
        return idMatches;
      }

      const nameMatches = scopedProducts.filter((product) =>
        this.productNameMatchesCategory(product, node)
      );
      if (nameMatches.length) {
        return nameMatches;
      }

      const parentId = this.normalizeId(node.parent_id);
      if (!parentId || parentId === rootId) {
        break;
      }
      node = this.allCategories.find(
        (cat: any) => this.normalizeId(cat.category_id) === parentId
      );
    }

    return [];
  }

  // Does the product name/title reference the given category by name? Handles simple
  // singular/plural variants (e.g. "Jackets" -> "jacket").
  private productNameMatchesCategory(product: any, category: any): boolean {
    const name = String(product?.name || product?.title || '').toLowerCase();
    const categoryName = String(category?.category_name || '').toLowerCase().trim();
    if (!name || categoryName.length < 3) {
      return false;
    }

    const variants = new Set<string>([categoryName]);
    if (categoryName.endsWith('s')) {
      variants.add(categoryName.slice(0, -1));
    } else {
      variants.add(`${categoryName}s`);
    }

    return Array.from(variants).some(
      (variant) => variant.length >= 3 && name.includes(variant)
    );
  }

  private productMatchesCategoryIds(product: any, categoryIds: Set<string>): boolean {
    return (
      categoryIds.has(this.normalizeId(product.category_id)) ||
      categoryIds.has(this.normalizeId(product.sub_category_id)) ||
      categoryIds.has(this.normalizeId(product.sub_sub_category_id))
    );
  }

  private findRootParentCategory(category: any): any | null {
    if (!category) {
      return null;
    }

    const parentId = category?.parent_id;
    if (parentId == null || String(parentId).trim() === '') {
      return category;
    }

    const parent = this.allCategories.find(
      (cat: any) => this.normalizeId(cat.category_id) === this.normalizeId(parentId)
    );
    if (!parent) {
      return category;
    }

    return this.findRootParentCategory(parent);
  }

  private tryApplyPendingCategoryFilter() {
    if (!this.pendingCategoryId || this.allCategories.length === 0) {
      return;
    }

    this.selectCategoryById(this.pendingCategoryId);
  }

  private applyFiltersFromState() {
    let result = [...this.products];

    if (this.newArrivalsOnly) {
      this.sortBy = 'newest';
    }

    if (this.featuredOnly) {
      result = result.filter((product: any) => this.isFeaturedProduct(product));
    }

    if (this.selectedCategory) {
      result = this.filterProductsByCategoryWithChildPriority(result, this.selectedCategory);
    } else if (this.pendingCategoryId) {
      const targetCategoryId = this.normalizeId(this.pendingCategoryId);
      const selectedCategoryFromList = this.allCategories.find(
        (cat: any) => this.normalizeId(cat.category_id) === targetCategoryId
      );

      if (selectedCategoryFromList) {
        result = this.filterProductsByCategoryWithChildPriority(
          result,
          selectedCategoryFromList
        );
      } else {
        const fallbackCategoryIds = new Set<string>([targetCategoryId]);
        result = result.filter((product: any) =>
          this.productMatchesCategoryIds(product, fallbackCategoryIds)
        );
      }
    }

    if (this.listingMode === 'search' && this.searchTerm) {
      result = result.filter((product: any) => {
        const name = (product?.name || '').toLowerCase();
        const brand = (product?.brand || '').toLowerCase();
        const desc = (product?.description || '').toLowerCase();
        return (
          name.includes(this.searchTerm) ||
          brand.includes(this.searchTerm) ||
          desc.includes(this.searchTerm)
        );
      });
    }

    if (this.listingMode === 'browse' && this.browseType && this.browseType !== 'all') {
      result = result.filter((product: any) => {
        const haystacks = [
          String(product?.name || '').toLowerCase(),
          String(product?.brand || '').toLowerCase(),
          String(product?.description || '').toLowerCase(),
        ];
        return haystacks.some((text) => text.includes(this.browseType));
      });
    }

    this.filteredProducts = result;
    this.applySort();
    this.visibleCount = this.pageSize;
  }

  private isTruthyFlag(value: any): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['t', 'true', '1', 'y', 'yes'].includes(normalized);
  }

  private getProductTimestamp(product: any): number {
    const candidate = product?.created_at || product?.updated_at || '';
    const parsed = Date.parse(String(candidate));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  onProductClick(product: any) {
    const selectedStoreId = this.normalizeId(product?.store_id);
    if (selectedStoreId) {
      localStorage.setItem('store_id', selectedStoreId);
    }

    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  onProductHover(product: any, isHovered: boolean) {
    this.hoveredProductId = isHovered ? this.normalizeId(product?.id) : null;
  }

  shouldPlayProductVideo(product: any): boolean {
    return (
      !!product?.video &&
      this.hoveredProductId === this.normalizeId(product?.id)
    );
  }

  muteProductVideo(video: HTMLVideoElement | null | undefined): void {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
  }

  onToggleFavorite(product: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const result = this.favoritesService.toggle(this.favoritesService.fromListProduct(product));
    if (result === 'login_required') return;
    this.actionFeedback.feedback(event, 'favorite', { added: result, image: product?.image });
  }

  isProductFavorite(product: any): boolean {
    return this.favoritesService.isFavorite(product?.id);
  }

  onAddToCart(product: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }

    const productId = this.normalizeId(product?.id);
    if (!productId) return;

    const apiProduct = this.apiProductsById.get(productId);
    if (!apiProduct) {
      // Fallback: open modal with minimal product shape so qty can still be chosen.
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

  getDiscountPercentage(product: any): number {
    if (!product.originalPrice) return 0;
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.sort-dropdown')) {
      this.isSortOpen = false;
    }
  }
}