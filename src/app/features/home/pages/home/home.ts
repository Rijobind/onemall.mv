import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { AllCategoryModel } from '../../../../core/models/all-category-model/all-category-model';

export interface HomeProductCard {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  image: string;
  store_id?: string;
  category_id?: string;
  sub_category_id?: string;
  sub_sub_category_id?: string;
  created_at?: string;
  featured_item?: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, Header, Footer, AllCategoryModel],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('recentlyViewedCarousel') recentlyViewedCarousel?: ElementRef<HTMLElement>;
  @ViewChild('interestCarousel') interestCarousel?: ElementRef<HTMLElement>;
  @ViewChild('newArrivalsCarousel') newArrivalsCarousel?: ElementRef<HTMLElement>;

  activeTab: string = 'feature';
  activeProductTab: string = 'top20';
  categories: any[] = [];
  categoryTree: any[] = [];
  allCategoryTree: any[] = []; // Full category tree for modal
  activeChildMap: Map<string, any> = new Map(); // Track active child for each parent category
  isAllCategoryModalOpen: boolean = false;
  mobileTopCategoryFallback: Array<{ category_name: string }> = [
    { category_name: 'Books & Stationery' },
    { category_name: 'Sports & Outdoors' },
    { category_name: 'Travel & Luggage' },
    { category_name: 'Home Products' },
    { category_name: 'Electronics' },
  ];
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
  activeMobileShopType: string = 'all';
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
  heroCategoryImages: string[] = Array.from({ length: 12 }, (_, idx) => `/Categories${idx + 1}.jpg`);
  activeHeroImageIndex: number = 0;
  nextHeroImageIndex: number = 1;
  isHeroImageTransitioning: boolean = false;
  private heroImageIntervalId: ReturnType<typeof setInterval> | null = null;
  private heroImageTransitionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly recentlyViewedStorageKey = 'recently_viewed_products';
  private readonly recentSearchesStorageKey = 'recent_searches';
  private allCategoriesFlat: any[] = [];
  private allMarketplaceCards: HomeProductCard[] = [];

  newArrivals: HomeProductCard[] = [];
  featuredProducts: HomeProductCard[] = [];
  discoverProductsForYou: HomeProductCard[] = [];
  recentlyViewed: HomeProductCard[] = [];

  constructor(private router: Router, private api: BackendapiServices) {}

  ngOnInit(): void {
    this.loadCategory();
    this.loadMarketplaceProducts();
    this.startHeroImageRotation();
  }

  ngOnDestroy(): void {
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

      // Store full tree for modal
      this.allCategoryTree = allCategoryTree;

      // Limit to 9 categories for home page
      this.categoryTree = allCategoryTree.slice(0, 9);

      // Transform to match the expected format for home page
      this.categories = this.categoryTree.map((parent: any) => ({
        name: parent.category_name,
        iconType: this.getIconType(parent.category_name),
        submenu: this.flattenChildren(parent.children),
      }));

      console.log('Home Category Tree:', this.categoryTree);
      this.refreshProductSections();
    });
  }

  private loadMarketplaceProducts(): void {
    this.api.getMarketplaceProducts().subscribe({
      next: (res: any) => {
        const rawList = this.extractProductList(res);
        this.allMarketplaceCards = rawList.map((product: any) => this.mapApiProductToCard(product));
        this.refreshProductSections();
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
    const rawPayload = res?.data ?? res;
    if (Array.isArray(rawPayload)) return rawPayload;
    if (rawPayload && typeof rawPayload === 'object') return [rawPayload];
    return [];
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

    return {
      id: this.normalizeId(product?.product_id ?? product?.id),
      name: product?.title || 'Untitled Product',
      category: this.resolveCategoryName(categoryId, subCategoryId, subSubCategoryId),
      price: basePrice,
      originalPrice: basePrice > 0 ? Math.round(basePrice * 1.2 * 100) / 100 : 0,
      image: imageUrl,
      store_id: this.resolveStoreId(product, variant),
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
        });
      }
    });

    this.recentlyViewed = resolved.slice(0, 12);
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
    this.isAllCategoryModalOpen = true;
  }

  onCloseAllCategoryModal() {
    this.isAllCategoryModalOpen = false;
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

  // Flatten children recursively to get all submenu items
  flattenChildren(children: any[]): string[] {
    if (!children || children.length === 0) return [];
    
    const result: string[] = [];
    children.forEach((child: any) => {
      result.push(child.category_name);
      if (child.children && child.children.length > 0) {
        result.push(...this.flattenChildren(child.children));
      }
    });
    return result;
  }

  // Map category names to icon types
  getIconType(categoryName: string): string {
    const name = categoryName.toLowerCase();

    if (name.includes('apparel') || name.includes('clothing') || name.includes('fashion') || name.includes('wear')) {
      return 'tshirt';
    } else if (name.includes('automotive') || name.includes('car') || name.includes('vehicle')) {
      return 'car';
    } else if (name.includes('beauty') || name.includes('personal care') || name.includes('cosmetic') || name.includes('health & beauty')) {
      return 'beauty';
    } else if (name.includes('electronic') || name.includes('device') || name.includes('tech') || name.includes('it')) {
      return 'electronics';
    } else if (name.includes('furniture')) {
      return 'furniture';
    } else if (name.includes('home') || name.includes('house') || name.includes('living')) {
      return 'home';
    } else if (name.includes('machinery') || name.includes('machine')) {
      return 'machinery';
    } else if (name.includes('jewelry') || name.includes('jewellery') || name.includes('watch') || name.includes('eyewear')) {
      return 'jewelry';
    } else if (name.includes('tool') || name.includes('hardware') || name.includes('improvement')) {
      return 'tool';
    } else if (name.includes('bestseller') || name.includes('best seller') || name.includes('popular')) {
      return 'bestseller';
    }

    return 'bestseller';
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
    console.log('Selected category:', category);
    // Example:
    // this.router.navigate(['/shop'], {
    //   queryParams: { categoryId: category.category_id }
    // });
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

  onMobileShopTypeClick(type: { label: string; value: string }) {
    this.activeMobileShopType = type.value;

    if (type.value === 'all') {
      this.router.navigate(['/product-list'], {
        queryParams: {
          mode: 'browse',
        },
      });
      return;
    }

    const matchedCategory = this.findCategoryForMobileShopType(type.value);
    if (matchedCategory?.category_id) {
      this.router.navigate(['/product-list'], {
        queryParams: {
          categoryId: matchedCategory.category_id,
          category_id: matchedCategory.category_id,
          categoryName: matchedCategory.category_name,
          mode: 'browse',
          type: type.value,
        },
      });
      return;
    }

    this.router.navigate(['/product-list'], {
      queryParams: {
        mode: 'browse',
        type: type.value,
      },
    });
  }

  isMobileShopTypeActive(value: string): boolean {
    return this.activeMobileShopType === value;
  }

  private findCategoryForMobileShopType(typeValue: string): any | null {
    const normalizedType = String(typeValue || '').toLowerCase().trim();
    if (!normalizedType || !this.allCategoriesFlat.length) {
      return null;
    }

    const categoryMatches = this.allCategoriesFlat.filter((category: any) => {
      const categoryName = String(category?.category_name || '').toLowerCase();
      return categoryName.includes(normalizedType);
    });

    if (!categoryMatches.length) {
      return null;
    }

    const parentMatch = categoryMatches.find(
      (category: any) => category?.parent_id == null
    );
    return parentMatch || categoryMatches[0];
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

  private startHeroImageRotation() {
    if (this.heroCategoryImages.length <= 1 || this.heroImageIntervalId) {
      return;
    }

    this.heroImageIntervalId = setInterval(() => {
      this.transitionHeroImage();
    }, 1000);
  }

  private transitionHeroImage() {
    if (this.isHeroImageTransitioning || this.heroCategoryImages.length <= 1) {
      return;
    }

    this.nextHeroImageIndex = (this.activeHeroImageIndex + 1) % this.heroCategoryImages.length;
    this.isHeroImageTransitioning = true;

    this.heroImageTransitionTimeoutId = setTimeout(() => {
      this.activeHeroImageIndex = this.nextHeroImageIndex;
      this.isHeroImageTransitioning = false;
      this.heroImageTransitionTimeoutId = null;
    }, 420);
  }

  dealOfTheDay = [
    {
      id: 1,
      title: 'Smart Thermostat',
      price: 79.99,
      originalPrice: 129.99,
      discount: 20,
      image: 'https://via.placeholder.com/200',
      timeLeft: '02:15:30',
    },
    {
      id: 2,
      title: 'Digital Camera',
      price: 299.99,
      originalPrice: 399.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
      timeLeft: '05:30:45',
    },
    {
      id: 3,
      title: 'Smartphone Pro',
      price: 599.99,
      originalPrice: 799.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
      timeLeft: '01:20:15',
    },
    {
      id: 4,
      title: 'Game Controller',
      price: 49.99,
      originalPrice: 69.99,
      discount: 29,
      image: 'https://via.placeholder.com/200',
      timeLeft: '03:45:20',
    },
  ];

  mainFeaturedProduct = {
    title: 'Professional Drone Camera',
    price: 103999,
    originalPrice: 129999,
    discount: 20,
    image: 'https://via.placeholder.com/400',
    thumbnails: [
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
    ],
  };

  promotionalBanners = [
    { title: 'CATCH BIG DEALS', category: 'Headphones', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Cameras', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Phones', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Watches', image: 'https://via.placeholder.com/250' },
  ];

  bestSellers = [
    { id: 1, title: 'Laptop Pro 16"', price: 1299.99, image: 'https://via.placeholder.com/200' },
    { id: 2, title: 'Smartphone X', price: 799.99, image: 'https://via.placeholder.com/200' },
    { id: 3, title: 'Portable Speaker', price: 89.99, image: 'https://via.placeholder.com/200' },
    { id: 4, title: 'USB Hub 7-in-1', price: 39.99, image: 'https://via.placeholder.com/200' },
    { id: 5, title: 'Smart Watch', price: 249.99, image: 'https://via.placeholder.com/200' },
    { id: 6, title: 'Smart Speaker', price: 99.99, image: 'https://via.placeholder.com/200' },
    { id: 7, title: 'Wireless Earbuds', price: 149.99, image: 'https://via.placeholder.com/200' },
    { id: 8, title: 'Wireless Mouse', price: 49.99, image: 'https://via.placeholder.com/200' },
  ];

  topProducts = [
    {
      id: 1,
      title: 'Wireless Headphones',
      price: 199.99,
      originalPrice: 299.99,
      discount: 33,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 2,
      title: 'Game Controller',
      price: 59.99,
      originalPrice: 79.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 3,
      title: 'Smartphone Ultra',
      price: 899.99,
      originalPrice: 1099.99,
      discount: 18,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 4,
      title: 'Laptop Air',
      price: 999.99,
      originalPrice: 1299.99,
      discount: 23,
      image: 'https://via.placeholder.com/200',
    },
  ];

  products = [
    {
      title: 'iPhone 15 Pro',
      price: 999,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'MacBook Air',
      price: 1299,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'Headphones',
      price: 199,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'Smart Watch',
      price: 249,
      image: 'https://via.placeholder.com/300',
    },
  ];

  setTab(tab: string) {
    this.activeTab = tab;
  }

  setProductTab(tab: string) {
    this.activeProductTab = tab;
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

  scrollNewArrivals(direction: 'left' | 'right') {
    if (this.newArrivalsCarousel?.nativeElement) {
      const scrollAmount = 240;
      const currentScroll = this.newArrivalsCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.newArrivalsCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
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
