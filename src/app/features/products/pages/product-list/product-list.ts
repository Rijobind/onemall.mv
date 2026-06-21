import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { FavoritesService } from '../../../../core/services/favorites.service/favorites.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service/action-feedback.service';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, Header, Footer],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export class ProductList implements OnInit {
  private readonly cartStorageKey = 'cart_items';
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
  hoveredProductId: string | null = null;
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

  constructor(
    private api: BackendapiServices,
    private router: Router,
    private route: ActivatedRoute,
    private favoritesService: FavoritesService,
    private actionFeedback: ActionFeedbackService
  ) {}

  ngOnInit(): void {
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
    this.logMarketplaceProductsResponse();
  }

  private logMarketplaceProductsResponse(): void {
    this.api.getMarketplaceProducts().subscribe({
      next: (res: any) => {
        console.log('Marketplace products API response:', res);
      },
      error: (error: any) => {
        console.error('Marketplace products API error:', error);
      },
    });
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
      console.log('Product List Category Tree:', this.categoryTree);

      this.tryApplyPendingCategoryFilter();
      this.refreshMobileSecondCategories();
    });
  }

  private refreshMobileSecondCategories(): void {
    if (!this.allCategories.length) {
      return;
    }
    this.mobileSecondCategories = this.buildMobileSecondCategories();
  }

  loadProducts() {
    this.api.getMarketplaceProducts().subscribe(
      (res: any) => {
        const apiProducts = res.data || [];
        
        // Transform API product data to match template structure
        this.products = apiProducts.map((product: any) => {
          const variant = product.im_ProductVariants?.[0];
          const images = variant?.im_ProductImages || [];
          const mediaUrls = images
            .map((img: any) => img?.image_url)
            .filter((url: string | undefined) => !!url);
          const firstVideo = mediaUrls.find((url: string) => this.isVideoMedia(url)) || null;
          const firstImage = mediaUrls.find((url: string) => !this.isVideoMedia(url)) || null;
          const inventory = variant?.im_StoreVariantInventory?.[0];
          const onHandQty = this.toSafeNumber(inventory?.on_hand_quantity, 0);
          const basePrice = this.toSafeNumber(variant?.base_price, 0);
          const storeId = this.resolveStoreIdFromProduct(product, variant);
          
          return {
            id: product.product_id,
            name: product.title || 'Untitled Product',
            price: basePrice,
            originalPrice: basePrice > 0 
              ? Math.round(basePrice * 1.2 * 100) / 100 
              : 0,
            rating: 4.5, // Default rating - update when API provides
            reviews: Math.floor(Math.random() * 5000) + 100, // Mock reviews - update when API provides
            image: product.thumbnail_url || firstImage || firstVideo || '/mobile.jpg',
            video: firstVideo,
            category_id: this.normalizeId(product.category_id),
            sub_category_id: this.normalizeId(product.sub_category_id),
            sub_sub_category_id: this.normalizeId(product.sub_sub_category_id),
            store_id: storeId,
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
        
        if (this.selectedCategory) {
          this.applyFiltersFromState();
        } else {
          this.applyFiltersFromState();
        }

        this.tryApplyPendingCategoryFilter();
        this.isLoading = false;
        this.refreshMobileSecondCategories();
      },
      (error) => {
        console.error('Error loading products:', error);
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
        this.refreshMobileSecondCategories();
      }
    );
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
        // Featured - keep original order
        break;
    }
    this.filteredProducts = products;
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
      const childCategoryIds = new Set(this.getAllCategoryIds(category));
      const parentProducts = products.filter((product: any) =>
        this.productMatchesCategoryIds(product, parentCategoryIds)
      );
      const childProducts = parentProducts.filter((product: any) =>
        this.productMatchesCategoryIds(product, childCategoryIds)
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
  }

  private isFeaturedProduct(product: any): boolean {
    const flag = String(product?.featured_item || '').trim().toUpperCase();
    return flag === 'T' || flag === 'TRUE' || flag === '1' || flag === 'Y' || flag === 'YES';
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

    this.router.navigate(['/product-details'], {
      queryParams: {
        productId: product.id,
        store_id: selectedStoreId || undefined,
      }
    });
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

  onToggleFavorite(product: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const added = this.favoritesService.toggle(this.favoritesService.fromListProduct(product));
    this.actionFeedback.feedback(event, 'favorite', { added, image: product?.image });
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

    const existingItems = this.getStoredCartItems();
    const existingIndex = existingItems.findIndex(
      (item: any) => this.normalizeId(item?.id) === productId
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex].quantity =
        (Number(existingItems[existingIndex].quantity) || 0) + 1;
      existingItems[existingIndex].price = Number(product?.price) || 0;
      existingItems[existingIndex].originalPrice = Number(product?.originalPrice) || 0;
      existingItems[existingIndex].image = product?.image || '/mobile.jpg';
      existingItems[existingIndex].name = product?.name || 'Untitled Product';
      existingItems[existingIndex].inStock = product?.inStock !== false;
    } else {
      existingItems.push({
        id: productId,
        name: product?.name || 'Untitled Product',
        price: Number(product?.price) || 0,
        originalPrice: Number(product?.originalPrice) || 0,
        image: product?.image || '/mobile.jpg',
        quantity: 1,
        inStock: product?.inStock !== false,
      });
    }

    localStorage.setItem(this.cartStorageKey, JSON.stringify(existingItems));
    window.dispatchEvent(new Event('cart-updated'));
    this.actionFeedback.feedback(event, 'cart', { image: product?.image });
  }

  getDiscountPercentage(product: any): number {
    if (!product.originalPrice) return 0;
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.sort-dropdown')) {
      this.isSortOpen = false;
    }
  }
}