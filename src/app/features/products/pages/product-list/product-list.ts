import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';

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
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const categoryId = params['categoryId'] || params['category_id'];
      this.searchTerm = (params['search'] || '').toString().trim().toLowerCase();

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
      console.log('Product List Category Tree:', this.categoryTree);

      this.tryApplyPendingCategoryFilter();
    });
  }

  loadProducts() {
    this.api.getAllProductList().subscribe(
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
            image: firstImage || product.thumbnail_url || firstVideo || '/mobile.jpg',
            video: firstVideo,
            category_id: this.normalizeId(product.category_id),
            sub_category_id: this.normalizeId(product.sub_category_id),
            sub_sub_category_id: this.normalizeId(product.sub_sub_category_id),
            store_id: storeId,
            description: product.description,
            brand: product.brand,
            inStock: onHandQty > 0,
            delivery: 'FREE delivery',
            offer: 'Up to 5% back',
            stock: onHandQty > 0 && onHandQty < 10 
              ? `Only ${onHandQty} left in stock` 
              : null,
          };
        });
        
        if (this.selectedCategory) {
          this.applyFiltersFromState();
        } else {
          this.applyFiltersFromState();
        }

        this.tryApplyPendingCategoryFilter();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading products:', error);
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
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
        products.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        break;
      default:
        // Featured - keep original order
        break;
    }
    this.filteredProducts = products;
  }

  private applyCategoryFilter(category: any) {
    const categoryIds = new Set(this.getAllCategoryIds(category));

    this.filteredProducts = this.products.filter((product: any) => {
      return (
        categoryIds.has(this.normalizeId(product.category_id)) ||
        categoryIds.has(this.normalizeId(product.sub_category_id)) ||
        categoryIds.has(this.normalizeId(product.sub_sub_category_id))
      );
    });

    this.applySort();
  }

  private tryApplyPendingCategoryFilter() {
    if (!this.pendingCategoryId || this.allCategories.length === 0) {
      return;
    }

    this.selectCategoryById(this.pendingCategoryId);
  }

  private applyFiltersFromState() {
    let result = [...this.products];

    if (this.selectedCategory) {
      const categoryIds = new Set(this.getAllCategoryIds(this.selectedCategory));
      result = result.filter((product: any) => {
        return (
          categoryIds.has(this.normalizeId(product.category_id)) ||
          categoryIds.has(this.normalizeId(product.sub_category_id)) ||
          categoryIds.has(this.normalizeId(product.sub_sub_category_id))
        );
      });
    } else if (this.pendingCategoryId) {
      const targetCategoryId = this.normalizeId(this.pendingCategoryId);
      const selectedCategoryFromList = this.allCategories.find(
        (cat: any) => this.normalizeId(cat.category_id) === targetCategoryId
      );
      const fallbackCategoryIds = new Set<string>(
        selectedCategoryFromList
          ? this.getAllCategoryIds(selectedCategoryFromList)
          : [targetCategoryId]
      );

      result = result.filter((product: any) => {
        return (
          fallbackCategoryIds.has(this.normalizeId(product.category_id)) ||
          fallbackCategoryIds.has(this.normalizeId(product.sub_category_id)) ||
          fallbackCategoryIds.has(this.normalizeId(product.sub_sub_category_id))
        );
      });
    }

    if (this.searchTerm) {
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

    this.filteredProducts = result;
    this.applySort();
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