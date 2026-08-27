import { ChangeDetectorRef, Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { combineLatest } from 'rxjs';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { BackendapiServices } from "../../../../core/services/backendapi.services/backendapi.services";
import { RegionService } from '../../../../core/services/region.service/region.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { FavoritesService } from "../../../../core/services/favorites.service/favorites.service";
import { ActionFeedbackService } from "../../../../core/services/action-feedback.service/action-feedback.service";
import { CartService } from '../../../../core/services/cart.service/cart.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HomeProductCard } from '../../../home/pages/home/home';
import {
  formatShopLocation,
  resolveCurrencySymbol,
  resolveStoreAddressRegion,
  resolveStoreRegionFromProduct,
} from '../../../../core/utils/marketplace-shop.util';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';
import {
  buildProductCommands,
  extractSlugGuidPrefix,
  isProductGuid,
  isSafeProductSlug,
  productIdMatchesSlugPrefix,
} from '../../../../core/utils/product-url.util';
import { extractApiData, isApiSuccess } from '../../../../core/utils/api-response.util';
import { CartModel, CartModelMode } from '../../models/cart-model/cart-model';
import { FollowService } from '../../../../core/services/follow.service/follow.service';
import {
  MarketplaceAd,
  MarketplaceAdsService,
} from '../../../../core/services/marketplace-ads.service/marketplace-ads.service';

interface ProductDetailAdView {
  image: string;
  imageDesktop: string;
  imageMobile: string;
  shopName: string;
  title: string;
  description: string;
  raw: MarketplaceAd | null;
}

@Component({
  selector: 'app-product-details',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer, CartModel],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css',
})
export class ProductDetails implements OnInit, OnDestroy {
  @ViewChild('recentlyViewedCarousel') recentlyViewedCarousel?: ElementRef<HTMLElement>;
  @ViewChild('relatedProductsCarousel') relatedProductsCarousel?: ElementRef<HTMLElement>;

  private readonly recentlyViewedStorageKey = 'recently_viewed_products';
  private allMarketplaceCards: HomeProductCard[] = [];
  private allCategoriesFlat: any[] = [];
  recentlyViewed: HomeProductCard[] = [];
  relatedProducts: HomeProductCard[] = [];
  qtyOptions: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  
  productId: string | null = null;
  /** SEO slug from route (or from API after load). */
  productSlug: string | null = null;
  private routeLoadKey: string | null = null;
  /** True when API/catalog could not resolve the product for this URL. */
  productNotFound = false;
  selectedImageIndex: number = 0;
  quantity: number = 1;
  selectedVariantIndex: number = 0;
  selectedColor: string = '';
  selectedSize: string = '';
  colors: string[] = [];
  sizes: string[] = [];
  variantGroups: any[] = [];
  apiProductData: any = null;
  selectedAttributes: Map<string, string> = new Map();
  isShareOpen: boolean = false;
  isCartModalOpen = false;
  cartModalMode: CartModelMode = 'add';
  cartModalInitialAttributes: Record<string, string> | null = null;
  attributeLabels: Map<string, string> = new Map();
  valueLabels: Map<string, string> = new Map();
  colorCodes: Map<string, string> = new Map();
  currentStoreId: string = '';
  priceCurrencySymbol: string = '$';
  shopProfile = {
    id: '',
    name: 'Unknown Shop',
    logo: '/store2.jpeg',
    totalProducts: '0',
    rating: 0,
    reviewsLabel: '0',
    responseRate: '',
    responseTime: '',
    itemsSoldLabel: '',
    followersLabel: '',
    atoll: '',
    city: '',
    location: '',
    isApiData: false,
  };
  isFollowingShop = false;
  followActionLoading = false;

  get colorGroup() {
    return this.variantGroups.find((g: any) => g.type === 'color');
  }

  get sizeGroup() {
    return this.variantGroups.find((g: any) => g.type === 'size');
  }

  product: any = {
    id: '',
    name: '',
    category: '',
    rating: 0,
    reviews: 0,
    sold: 0,
    price: 0,
    originalPrice: 0,
    brand: '',
    capacity: '',
    material: '',
    wattage: '',
    images: [] as string[],
    aboutItems: [] as string[],
    description: '',
    productInfo: {
      dimensions: '',
      weight: '',
      warranty: '',
      manufacturer: '',
    },
  };

  reviewBreakdown = [
    { label: 'Small', percent: 0 },
    { label: 'True to size', percent: 0 },
    { label: 'Large', percent: 0 },
  ];

  productReviews: any[] = [];

  activeTab: string = 'description';
  isLoading: boolean = true;

  productDetailAds: ProductDetailAdView[] = [];
  currentProductDetailAdIndex = 0;
  productDetailAdFading = false;
  private productDetailAdInterval: ReturnType<typeof setInterval> | null = null;
  private productDetailAdFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly regionUpdatedHandler = () => {
    this.reloadCurrentProduct();
  };
  private readonly currencyUpdatedHandler = (event: Event) => {
    const detail = (event as CustomEvent)?.detail;
    this.reloadCurrentProduct(detail?.currency_code);
  };

  get currentProductDetailAd() {
    return this.productDetailAds[this.currentProductDetailAdIndex];
  }

  get isImageOnlyProductDetailAd(): boolean {
    const ad = this.currentProductDetailAd;
    return !!ad && !ad.shopName && !ad.title && !ad.description;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: BackendapiServices,
    private sanitizer: DomSanitizer,
    private favoritesService: FavoritesService,
    private actionFeedback: ActionFeedbackService,
    private regionService: RegionService,
    private cartService: CartService,
    private currencyService: CurrencyService,
    private followService: FollowService,
    private title: Title,
    private ads: MarketplaceAdsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadProductDetailAds();
    if (typeof window !== 'undefined') {
      window.addEventListener('region-updated', this.regionUpdatedHandler);
      window.addEventListener('currency-updated', this.currencyUpdatedHandler);
    }
    this.api.getAllCategoryList().subscribe((res: any) => {
      const allCategories = res?.data || [];
      this.allCategoriesFlat = Array.isArray(allCategories) ? allCategories : [];
      this.refreshCardCategoryNames();
      this.buildRelatedProducts();
    });

    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(
      ([params, query]) => {
        const slugParam = String(params.get('slug') || '').trim();
        const productIdQuery = String(query.get('productId') || '').trim();
        this.currentStoreId = this.resolveStoreIdFromRoute({
          store_id: query.get('store_id'),
        });

        const loadKey = slugParam
          ? `slug:${slugParam}`
          : productIdQuery
            ? `id:${productIdQuery}`
            : '';

        if (!loadKey) {
          this.isLoading = false;
          this.cdr.markForCheck();
          return;
        }

        // Skip duplicate emit from canonicalize replaceUrl when product already shown.
        if (
          loadKey === this.routeLoadKey &&
          this.apiProductData &&
          !this.isLoading
        ) {
          return;
        }
        this.routeLoadKey = loadKey;
        this.isLoading = true;
        this.productNotFound = false;
        this.apiProductData = null;
        this.cdr.markForCheck();

        if (slugParam) {
          this.productSlug = slugParam;
          if (isProductGuid(slugParam)) {
            this.productId = slugParam;
            this.loadProductById(slugParam, undefined, true);
          } else {
            this.loadProductBySlug(slugParam);
          }
          return;
        }

        // Legacy: /product-details?productId=
        this.productId = productIdQuery;
        this.loadProductById(productIdQuery, undefined, true);
      }
    );
  }

  ngOnDestroy(): void {
    this.stopProductDetailAdRotation();
    if (typeof window !== 'undefined') {
      window.removeEventListener('region-updated', this.regionUpdatedHandler);
      window.removeEventListener('currency-updated', this.currencyUpdatedHandler);
    }
  }

  private loadProductDetailAds(): void {
    this.ads.getAdsBySlot('profile_product_details').subscribe((ads) => {
      this.productDetailAds = ads
        .map((ad) => this.mapProductDetailAd(ad))
        .filter((ad) => !!ad.imageDesktop || !!ad.imageMobile || !!ad.image);
      this.currentProductDetailAdIndex = 0;
      this.startProductDetailAdRotation();
      this.cdr.detectChanges();
    });
  }

  private mapProductDetailAd(ad: MarketplaceAd): ProductDetailAdView {
    const image = this.ads.desktopImage(ad) || this.ads.mobileImage(ad);
    return {
      image,
      imageDesktop: this.ads.desktopImage(ad, image),
      imageMobile: this.ads.mobileImage(ad, image),
      shopName: this.ads.shopName(ad),
      title: ad.title,
      description: ad.description,
      raw: ad,
    };
  }

  private startProductDetailAdRotation(): void {
    this.stopProductDetailAdRotation();
    if (this.productDetailAds.length <= 1) return;
    this.productDetailAdInterval = setInterval(() => {
      this.productDetailAdFading = true;
      this.productDetailAdFadeTimer = setTimeout(() => {
        this.currentProductDetailAdIndex =
          (this.currentProductDetailAdIndex + 1) % this.productDetailAds.length;
        this.productDetailAdFading = false;
      }, 550);
    }, 5200);
  }

  private stopProductDetailAdRotation(): void {
    if (this.productDetailAdInterval) {
      clearInterval(this.productDetailAdInterval);
      this.productDetailAdInterval = null;
    }
    if (this.productDetailAdFadeTimer) {
      clearTimeout(this.productDetailAdFadeTimer);
      this.productDetailAdFadeTimer = null;
    }
  }

  private reloadCurrentProduct(currencyOverride?: string): void {
    if (this.productSlug && !isProductGuid(this.productSlug)) {
      this.loadProductBySlug(this.productSlug, currencyOverride);
      return;
    }
    if (this.productId) {
      this.loadProductById(this.productId, currencyOverride, false);
    }
  }

  /** @deprecated Prefer loadProductBySlug / loadProductById. Kept for call-site clarity. */
  loadProduct(productId: string, currencyOverride?: string) {
    this.loadProductById(productId, currencyOverride, false);
  }

  private loadProductBySlug(slug: string, currencyOverride?: string): void {
    const generation = this.currencyService.fetchGeneration;
    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );

    // Unsafe / backend-rejected slugs → skip by-slug and resolve via catalog / id suffix.
    if (!isSafeProductSlug(slug)) {
      this.resolveProductFromCatalog(slug, params, generation, true);
      return;
    }

    this.api.getMarketplaceProductBySlug(slug, params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const product = this.extractSingleProduct(res);
        if (!product) {
          this.resolveProductFromCatalog(slug, params, generation, true);
          return;
        }
        this.applyLoadedProduct(product);
        this.loadRelatedCatalog(params, generation);
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.resolveProductFromCatalog(slug, params, generation, true);
      },
    });
  }

  private loadProductById(
    productId: string,
    currencyOverride?: string,
    canonicalize = false
  ): void {
    const generation = this.currencyService.fetchGeneration;
    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );

    this.api.getMarketplaceProductById(productId, params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const product = this.extractSingleProduct(res);
        if (!product) {
          this.loadProductFromCatalogFallback(productId, params, generation, canonicalize);
          return;
        }
        this.applyLoadedProduct(product);
        if (canonicalize) {
          this.canonicalizeUrl(product);
        }
        this.loadRelatedCatalog(params, generation);
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.loadProductFromCatalogFallback(productId, params, generation, canonicalize);
      },
    });
  }

  /**
   * When by-slug fails (Invalid slug / 404), find the product in the marketplace list
   * by exact slug or by the trailing 8-char guid prefix in the slug.
   */
  private resolveProductFromCatalog(
    slug: string,
    params: any,
    generation: number,
    canonicalize: boolean
  ): void {
    this.api.getMarketplaceProductsWithFallback(params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const productList = this.api.extractProductsFromResponse(res);
        this.allMarketplaceCards = productList.map((product: any) =>
          this.mapApiProductToCard(product)
        );
        this.refreshCardCategoryNames();

        const needle = String(slug || '').trim().toLowerCase();
        const prefix = extractSlugGuidPrefix(slug);

        let matched =
          productList.find(
            (p: any) => String(p?.slug || '').trim().toLowerCase() === needle
          ) || null;

        if (!matched && prefix) {
          matched =
            productList.find((p: any) =>
              productIdMatchesSlugPrefix(
                String(p?.product_id ?? p?.id ?? ''),
                prefix
              )
            ) || null;
        }

        if (!matched) {
          this.markProductNotFound();
          this.buildRecentlyViewed();
          this.buildRelatedProducts();
          return;
        }

        this.applyLoadedProduct(matched);
        if (canonicalize) {
          this.canonicalizeUrl(matched);
        }
        this.buildRecentlyViewed();
        this.buildRelatedProducts();
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.markProductNotFound();
      },
    });
  }

  private loadProductFromCatalogFallback(
    productId: string,
    params: any,
    generation: number,
    canonicalize: boolean
  ): void {
    this.api.getMarketplaceProductsWithFallback(params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const productList = this.api.extractProductsFromResponse(res);
        const matchedProduct = productList.find(
          (product: any) =>
            String(product?.product_id ?? product?.id ?? '') === String(productId)
        );
        this.allMarketplaceCards = productList.map((product: any) =>
          this.mapApiProductToCard(product)
        );
        this.refreshCardCategoryNames();
        if (!matchedProduct) {
          this.markProductNotFound();
          this.buildRecentlyViewed();
          this.buildRelatedProducts();
          return;
        }
        this.applyLoadedProduct(matchedProduct);
        if (canonicalize) {
          this.canonicalizeUrl(matchedProduct);
        }
        this.buildRecentlyViewed();
        this.buildRelatedProducts();
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.allMarketplaceCards = [];
        this.markProductNotFound();
        this.buildRecentlyViewed();
        this.buildRelatedProducts();
      },
    });
  }

  private loadRelatedCatalog(params: any, generation: number): void {
    this.api.getMarketplaceProductsWithFallback(params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        const productList = this.api.extractProductsFromResponse(res);
        this.allMarketplaceCards = productList.map((product: any) =>
          this.mapApiProductToCard(product)
        );
        this.refreshCardCategoryNames();
        this.buildRecentlyViewed();
        this.buildRelatedProducts();
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.buildRecentlyViewed();
        this.buildRelatedProducts();
      },
    });
  }

  private extractSingleProduct(res: any): any | null {
    if (!isApiSuccess(res) && res?.success !== true && res?.Success !== true) {
      // Some APIs return success with a single object still parseable via data
      const data = extractApiData(res);
      if (data && !Array.isArray(data) && (data.product_id || data.slug)) {
        return data;
      }
      return null;
    }
    const data = extractApiData(res);
    if (data && !Array.isArray(data)) return data;
    if (Array.isArray(data) && data.length) return data[0];
    return null;
  }

  private applyLoadedProduct(matchedProduct: any): void {
    this.productNotFound = false;
    this.productId = String(matchedProduct?.product_id ?? matchedProduct?.id ?? '');
    this.productSlug = String(matchedProduct?.slug || this.productSlug || '').trim() || null;
    this.transformProductData(matchedProduct);
    this.loadShopProfileForProduct(matchedProduct);
    const titleName = String(matchedProduct?.title || this.product?.name || 'Product').trim();
    this.title.setTitle(`${titleName} | OneMall`);
    this.isLoading = false;
    this.cdr.markForCheck();
  }

  private markProductNotFound(): void {
    this.productNotFound = true;
    this.apiProductData = null;
    this.isLoading = false;
    this.title.setTitle('Product not found | OneMall');
    this.cdr.markForCheck();
  }

  private canonicalizeUrl(product: any): void {
    const slug = String(product?.slug || '').trim();
    // Only rewrite URL when backend will accept the slug on reload.
    if (!isSafeProductSlug(slug)) return;

    const currentSlug = String(this.route.snapshot.paramMap.get('slug') || '').trim();
    if (currentSlug === slug) return;

    this.routeLoadKey = `slug:${slug}`;
    this.router.navigate(['/product', slug], {
      replaceUrl: true,
      queryParams: {
        store_id: this.currentStoreId || null,
        productId: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  transformProductData(apiProduct: any) {
    this.apiProductData = apiProduct;
    this.initializeVariants(apiProduct);
    const variant = this.getSelectedVariant();
    this.updateProductFromVariant(variant, apiProduct, false);
    if (!this.currentStoreId) {
      this.currentStoreId = this.resolveStoreIdFromProduct(apiProduct, variant);
    }
    this.trackRecentlyViewed(apiProduct, variant);
  }

  private trackRecentlyViewed(apiProduct: any, variant: any): void {
    if (typeof window === 'undefined' || !apiProduct) return;

    const productId = String(apiProduct?.product_id ?? '').trim();
    if (!productId) return;

    const images = variant?.im_ProductImages || [];
    const primaryImage =
      images.find((img: any) => img?.is_primary === 'T')?.image_url ||
      images[0]?.image_url ||
      apiProduct?.thumbnail_url ||
      '/mobile.jpg';
    const basePrice = Number(variant?.base_price ?? 0);

    const entry = {
      id: productId,
      productId,
      slug: String(apiProduct?.slug || '').trim() || undefined,
      name: apiProduct?.title || 'Untitled Product',
      category: this.resolveCategoryName(
        this.normalizeProductId(apiProduct?.category_id),
        this.normalizeProductId(apiProduct?.sub_category_id),
        this.normalizeProductId(apiProduct?.sub_sub_category_id)
      ),
      price: basePrice,
      originalPrice: 0,
      image: primaryImage,
      store_id: this.resolveStoreIdFromProduct(apiProduct, variant),
      store_currency_code: String(apiProduct?.default_currency || '').trim().toUpperCase(),
      store_currency_symbol: resolveCurrencySymbol(apiProduct?.default_currency),
      viewedAt: Date.now(),
    };

    const existing = this.getStoredRecentlyViewed();
    const filtered = existing.filter(
      (item: any) => String(item?.id ?? item?.productId ?? '').trim() !== productId
    );
    const updated = [entry, ...filtered].slice(0, 20);
    localStorage.setItem(this.recentlyViewedStorageKey, JSON.stringify(updated));
    this.buildRecentlyViewed();
  }

  private buildRecentlyViewed(): void {
    const stored = this.getStoredRecentlyViewed();
    const currentId = String(this.productId ?? '').trim();
    const resolved: HomeProductCard[] = [];

    stored.forEach((entry: any) => {
      const productId = this.normalizeProductId(entry?.id ?? entry?.productId);
      if (!productId || productId === currentId) return;

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
    this.cdr.markForCheck();
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
    const display = resolveVariantDisplayPrice(variant, product);
    const categoryId = this.normalizeProductId(product?.category_id);
    const subCategoryId = this.normalizeProductId(product?.sub_category_id);
    const subSubCategoryId = this.normalizeProductId(product?.sub_sub_category_id);

    return {
      id: this.normalizeProductId(product?.product_id ?? product?.id),
      slug: String(product?.slug || '').trim() || undefined,
      name: product?.title || 'Untitled Product',
      category: this.resolveCategoryName(categoryId, subCategoryId, subSubCategoryId),
      price: display.price,
      originalPrice: display.originalPrice,
      image: imageUrl,
      store_id: this.resolveStoreIdFromProduct(product, variant),
      store_currency_code: display.display_currency,
      store_currency_symbol: display.display_symbol,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      sub_sub_category_id: subSubCategoryId,
    };
  }

  private refreshCardCategoryNames(): void {
    if (!this.allCategoriesFlat.length || !this.allMarketplaceCards.length) return;

    this.allMarketplaceCards = this.allMarketplaceCards.map((product) => ({
      ...product,
      category: this.resolveCategoryName(
        product.category_id || '',
        product.sub_category_id || '',
        product.sub_sub_category_id || ''
      ),
    }));
  }

  private buildRelatedProducts(): void {
    const currentId = String(this.productId ?? '').trim();
    const primaryCategoryId = this.getPrimaryCategoryId(this.apiProductData);

    if (!primaryCategoryId || !this.allMarketplaceCards.length) {
      this.relatedProducts = [];
      return;
    }

    this.relatedProducts = this.allMarketplaceCards
      .filter(
        (product) =>
          product.id !== currentId && this.productSharesCategory(product, primaryCategoryId)
      )
      .slice(0, 12);
  }

  private getPrimaryCategoryId(product: any): string {
    if (!product) return '';
    const subSub = this.normalizeProductId(product?.sub_sub_category_id);
    if (subSub) return subSub;
    const sub = this.normalizeProductId(product?.sub_category_id);
    if (sub) return sub;
    return this.normalizeProductId(product?.category_id);
  }

  private productSharesCategory(product: HomeProductCard, categoryId: string): boolean {
    if (!categoryId) return false;
    return (
      product.category_id === categoryId ||
      product.sub_category_id === categoryId ||
      product.sub_sub_category_id === categoryId
    );
  }

  private resolveCategoryName(
    categoryId: string,
    subCategoryId: string,
    subSubCategoryId: string
  ): string {
    const ids = [subSubCategoryId, subCategoryId, categoryId].filter(Boolean);
    for (const id of ids) {
      const match = this.allCategoriesFlat.find(
        (cat: any) => this.normalizeProductId(cat?.category_id ?? cat?.id) === id
      );
      if (match?.category_name || match?.name) {
        return match.category_name || match.name;
      }
    }
    return 'Products';
  }

  private normalizeProductId(value: any): string {
    return value == null ? '' : String(value);
  }

  scrollRecentlyViewed(direction: 'left' | 'right'): void {
    this.scrollProductCarousel(this.recentlyViewedCarousel, direction);
  }

  scrollRelatedProducts(direction: 'left' | 'right'): void {
    this.scrollProductCarousel(this.relatedProductsCarousel, direction);
  }

  private scrollProductCarousel(
    carousel: ElementRef<HTMLElement> | undefined,
    direction: 'left' | 'right'
  ): void {
    if (!carousel?.nativeElement) return;
    const scrollAmount = 280;
    const currentScroll = carousel.nativeElement.scrollLeft;
    const newScroll =
      direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
    carousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
  }

  onRecentlyViewedProductClick(product: HomeProductCard): void {
    this.navigateToProduct(product);
  }

  onRelatedProductClick(product: HomeProductCard): void {
    this.navigateToProduct(product);
  }

  private navigateToProduct(product: HomeProductCard): void {
    if (!product?.id && !(product as any)?.slug) return;
    if (product.store_id && typeof window !== 'undefined') {
      localStorage.setItem('store_id', product.store_id);
    }
    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  private getStoredRecentlyViewed(): any[] {
    const raw = localStorage.getItem(this.recentlyViewedStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  initializeVariants(apiProduct: any) {
    const variants = apiProduct.im_ProductVariants || [];
    this.attributeLabels.clear();
    this.valueLabels.clear();
    this.colorCodes.clear();
    this.selectedAttributes.clear();
    this.colors = [];
    this.sizes = [];
    this.selectedColor = '';
    this.selectedSize = '';
    this.variantGroups = [];

    if (variants.length === 0) return;

    const attributeMap = new Map<string, Set<string>>();
    const attributeMeta = new Map<
      string,
      { names: Set<string>; attrs: any[]; colorScore: number; sizeScore: number }
    >();
    variants.forEach((v: any) => {
      if (v.im_VariantAttributes && v.im_VariantAttributes.length > 0) {
        v.im_VariantAttributes.forEach((attr: any) => {
          if (attr.attribute_id && attr.value_id) {
            if (!attributeMap.has(attr.attribute_id)) {
              attributeMap.set(attr.attribute_id, new Set());
            }
            attributeMap.get(attr.attribute_id)!.add(attr.value_id);

            if (!attributeMeta.has(attr.attribute_id)) {
              attributeMeta.set(attr.attribute_id, {
                names: new Set<string>(),
                attrs: [],
                colorScore: 0,
                sizeScore: 0,
              });
            }
            const meta = attributeMeta.get(attr.attribute_id)!;
            meta.attrs.push(attr);

            const attrName = String(
              attr?.attribute_name || attr?.attributeName || attr?.name || ''
            ).trim();
            if (attrName) {
              meta.names.add(attrName);
            }

            if (this.isColorLikeAttribute(attr)) {
              meta.colorScore += 2;
            }
            if (this.isSizeLikeAttribute(attr)) {
              meta.sizeScore += 2;
            }
            if (/color/i.test(attrName)) {
              meta.colorScore += 4;
            }
            if (/size/i.test(attrName)) {
              meta.sizeScore += 4;
            }

            if (!this.valueLabels.has(attr.value_id)) {
              const readableValue = this.getReadableVariantValue(attr);
              if (readableValue) {
                this.valueLabels.set(attr.value_id, readableValue);
              } else {
                this.valueLabels.set(attr.value_id, attr.value_id?.length > 12 ? attr.value_id.slice(0, 8) + '…' : (attr.value_id || ''));
              }
            }

            if (!this.colorCodes.has(attr.value_id)) {
              const rawValue = String(attr?.value || '').trim();
              const rawColorName = String(attr?.color_name || '').trim();
              if (this.isHexColor(rawValue)) {
                this.colorCodes.set(attr.value_id, rawValue);
              } else if (this.isHexColor(rawColorName)) {
                this.colorCodes.set(attr.value_id, rawColorName);
              }
            }
          }
        });
      }
    });

    const attributeIds = Array.from(attributeMap.keys());
    const sortedByColor = [...attributeIds].sort((a, b) => {
      const aScore = attributeMeta.get(a)?.colorScore || 0;
      const bScore = attributeMeta.get(b)?.colorScore || 0;
      return bScore - aScore;
    });
    const sortedBySize = [...attributeIds].sort((a, b) => {
      const aScore = attributeMeta.get(a)?.sizeScore || 0;
      const bScore = attributeMeta.get(b)?.sizeScore || 0;
      return bScore - aScore;
    });

    const colorAttrId = sortedByColor[0] || '';
    const sizeAttrId =
      sortedBySize.find((id) => id !== colorAttrId) ||
      attributeIds.find((id) => id !== colorAttrId) ||
      '';

    attributeIds.forEach((attrId, idx) => {
      const fallbackLabel = idx === 0 ? 'Color' : idx === 1 ? 'Size' : `Option ${idx + 1}`;
      const metaLabel = Array.from(attributeMeta.get(attrId)?.names || [])[0];
      const finalLabel = metaLabel || fallbackLabel;
      this.attributeLabels.set(attrId, finalLabel);
    });

    if (colorAttrId) {
      this.colors = Array.from(attributeMap.get(colorAttrId) || []);
    }

    if (sizeAttrId && sizeAttrId !== colorAttrId) {
      this.sizes = Array.from(attributeMap.get(sizeAttrId) || []);
    }

    // Do not auto-select variants — user must choose on page or in cart modal.
    this.selectedColor = '';
    this.selectedSize = '';
    this.selectedAttributes.clear();

    this.variantGroups = attributeIds.map((attrId, idx) => ({
      attributeId: attrId,
      values: Array.from(attributeMap.get(attrId) || []),
      type:
        attrId === colorAttrId
          ? 'color'
          : attrId === sizeAttrId
            ? 'size'
            : idx === 2
              ? 'style'
              : idx === 3
                ? 'material'
                : 'option',
      label: this.attributeLabels.get(attrId) || `Option ${idx + 1}`
    }));
  }

  /** True when product has no option groups, or every group has a selection. */
  areAllRequiredVariantsSelected(): boolean {
    if (!this.variantGroups.length) return true;
    return this.variantGroups.every(
      (g: any) => !!this.selectedAttributes.get(g.attributeId)
    );
  }

  openCartModal(mode: CartModelMode = 'add'): void {
    const attrs: Record<string, string> = {};
    this.selectedAttributes.forEach((valueId, attrId) => {
      if (attrId && valueId) attrs[attrId] = valueId;
    });
    this.cartModalInitialAttributes = Object.keys(attrs).length ? attrs : null;
    this.cartModalMode = mode;
    this.isCartModalOpen = true;
  }

  closeCartModal(): void {
    this.isCartModalOpen = false;
  }

  onCartModalAdded(): void {
    this.isCartModalOpen = false;
  }

  getAttributeLabel(attrId: string): string {
    return this.attributeLabels.get(attrId) || 'Option';
  }

  getValueDisplayLabel(valueId: string): string {
    return this.valueLabels.get(valueId) || (valueId?.length > 12 ? valueId.slice(0, 8) + '…' : valueId) || '';
  }

  getSelectedValueLabelByType(type: string): string {
    const group = this.variantGroups.find((g: any) => g.type === type);
    if (!group) return '';
    const valueId = this.selectedAttributes.get(group.attributeId) || '';
    return this.getValueDisplayLabel(valueId);
  }

  getColorCodeByValue(valueId: string): string {
    const explicitColorCode = this.colorCodes.get(valueId);
    if (explicitColorCode) return explicitColorCode;

    const label = String(this.getValueDisplayLabel(valueId) || '').trim();
    if (!label) return '#d1d5db';

    // Use named CSS colors when backend does not provide hex color code.
    if (typeof document !== 'undefined') {
      const tester = document.createElement('span');
      tester.style.color = '';
      tester.style.color = label.toLowerCase();
      if (tester.style.color) {
        return label.toLowerCase();
      }
    }

    return '#d1d5db';
  }

  getSelectedColorCode(): string {
    if (!this.colorGroup) return '#d1d5db';
    const selectedValueId = this.selectedAttributes.get(this.colorGroup.attributeId) || '';
    return this.getColorCodeByValue(selectedValueId);
  }

  getColorOptionImage(valueId: string): string {
    if (!this.apiProductData || !this.colorGroup) {
      return this.product?.images?.[0] || '/mobile.jpg';
    }

    const colorAttrId = this.colorGroup.attributeId;
    const sizeAttrId = this.sizeGroup?.attributeId;
    const selectedSizeValue = sizeAttrId ? this.selectedAttributes.get(sizeAttrId) : '';
    const variants = this.apiProductData.im_ProductVariants || [];

    const colorMatched = variants.filter((v: any) =>
      v.im_VariantAttributes?.some((attr: any) => attr.attribute_id === colorAttrId && attr.value_id === valueId)
    );

    if (colorMatched.length === 0) {
      return this.product?.images?.[0] || '/mobile.jpg';
    }

    const exactVariant = selectedSizeValue
      ? colorMatched.find((v: any) =>
          v.im_VariantAttributes?.some((attr: any) => attr.attribute_id === sizeAttrId && attr.value_id === selectedSizeValue)
        )
      : null;

    const preferredVariant = exactVariant || colorMatched[0];
    return this.getVariantImage(preferredVariant, this.apiProductData);
  }

  private getReadableVariantValue(attr: any): string {
    const value = String(attr?.value || '').trim();
    const colorName = String(attr?.color_name || '').trim();
    const sizeName = String(attr?.size_name || '').trim();

    const valueLooksLikeHex = this.isHexColor(value);
    const colorNameLooksLikeHex = this.isHexColor(colorName);
    const valueLooksLikeId = /^\d+$/.test(value) || /^[a-f0-9-]{12,}$/i.test(value);

    if (sizeName) return sizeName;
    if (colorName && (valueLooksLikeId || !value || valueLooksLikeHex)) return colorName;
    // Prefer non-hex, human-readable labels.
    if (value && !valueLooksLikeHex && !valueLooksLikeId) return value;
    if (colorName && !colorNameLooksLikeHex) return colorName;
    if (value) return value;
    if (colorName) return colorName;
    return '';
  }

  private isColorLikeAttribute(attr: any): boolean {
    const value = String(attr?.value || '').trim().toLowerCase();
    const colorName = String(attr?.color_name || '').trim().toLowerCase();
    const attrName = String(attr?.attribute_name || attr?.attributeName || '').trim().toLowerCase();
    const commonColors = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'purple',
      'brown', 'grey', 'gray', 'beige', 'gold', 'silver', 'navy', 'maroon',
    ];
    return (
      this.isHexColor(value) ||
      this.isHexColor(colorName) ||
      commonColors.includes(value) ||
      commonColors.includes(colorName) ||
      /color|colour/.test(attrName)
    );
  }

  private isSizeLikeAttribute(attr: any): boolean {
    const value = String(attr?.value || '').trim().toLowerCase();
    const sizeName = String(attr?.size_name || '').trim().toLowerCase();
    const attrName = String(attr?.attribute_name || attr?.attributeName || '').trim().toLowerCase();
    const sizePattern = /^(xs|s|m|l|xl|xxl|xxxl|\d+(\.\d+)?(cm|mm|in|inch)?|\d{2,3})$/i;
    return (
      sizePattern.test(value) ||
      sizePattern.test(sizeName) ||
      /size/.test(attrName)
    );
  }

  private isHexColor(text: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((text || '').trim());
  }

  onAttributeSelect(attributeId: string, valueId: string) {
    if (!this.isAttributeValueAvailable(attributeId, valueId)) {
      return;
    }
    if (this.variantGroups.find((g: any) => g.attributeId === attributeId)?.type === 'color') {
      this.selectedColor = valueId;
    } else if (this.variantGroups.find((g: any) => g.attributeId === attributeId)?.type === 'size') {
      this.selectedSize = valueId;
    }
    this.selectedAttributes.set(attributeId, valueId);
    // Only update display from the best match — do not auto-fill other options.
    const variant = this.findMatchingVariantWithoutMutating();
    if (variant && this.apiProductData) {
      this.updateProductFromVariant(variant, this.apiProductData, true);
    }
  }

  isAttributeValueSelected(attributeId: string, valueId: string): boolean {
    return this.selectedAttributes.get(attributeId) === valueId;
  }

  isAttributeValueAvailable(attributeId: string, valueId: string): boolean {
    const variants = this.apiProductData?.im_ProductVariants || [];
    if (!Array.isArray(variants) || variants.length === 0) {
      return true;
    }

    return variants.some((variant: any) => {
      const attributes = variant?.im_VariantAttributes || [];
      const hasCandidate = attributes.some(
        (attr: any) => attr.attribute_id === attributeId && attr.value_id === valueId
      );
      if (!hasCandidate) return false;

      for (const [selectedAttrId, selectedValueId] of this.selectedAttributes.entries()) {
        if (selectedAttrId === attributeId || !selectedValueId) continue;
        const hasSelected = attributes.some(
          (attr: any) =>
            attr.attribute_id === selectedAttrId && attr.value_id === selectedValueId
        );
        if (!hasSelected) return false;
      }

      return true;
    });
  }

  getSelectedVariant(): any {
    return this.findMatchingVariantWithoutMutating();
  }

  /** Match current selections to a variant without auto-selecting other attributes. */
  private findMatchingVariantWithoutMutating(): any {
    if (!this.apiProductData?.im_ProductVariants) return null;
    const variants = this.apiProductData.im_ProductVariants;
    if (!variants.length) return null;

    if (this.selectedAttributes.size === 0) {
      return variants[0] || null;
    }

    for (const variant of variants) {
      const attributes = variant.im_VariantAttributes || [];
      let matches = true;
      for (const [attrId, valueId] of this.selectedAttributes.entries()) {
        const hasAttribute = attributes.some(
          (attr: any) => attr.attribute_id === attrId && attr.value_id === valueId
        );
        if (!hasAttribute) {
          matches = false;
          break;
        }
      }
      if (matches) return variant;
    }
    return variants[0] || null;
  }

  updateProductFromVariant(
    variant: any,
    apiProduct: any,
    preferVariantImage: boolean = false
  ) {
    const variants = apiProduct?.im_ProductVariants || [];
    if (!variant) variant = variants[0];
    const images = variant?.im_ProductImages || [];
    const variantImages: string[] = [];
    if (variant) {
      images.forEach((img: any) => {
        if (img?.image_url && !variantImages.includes(img.image_url)) variantImages.push(img.image_url);
      });
    }
    const primaryImage = images.find((img: any) => img?.is_primary === 'T') || images[0];
    const thumbnail = apiProduct?.thumbnail_url || primaryImage?.image_url || variantImages[0] || '/mobile.jpg';

    if (variantImages.length === 0) {
      variantImages.push(thumbnail);
    } else if (!preferVariantImage && thumbnail && !variantImages.includes(thumbnail)) {
      // Initial load keeps thumbnail as first image.
      variantImages.unshift(thumbnail);
    } else if (preferVariantImage && thumbnail && !variantImages.includes(thumbnail)) {
      // After variant/color selection, keep variant image first and append thumbnail as fallback.
      variantImages.push(thumbnail);
    }

    const inventory = variant?.im_StoreVariantInventory?.[0];
    const onHandQty = inventory?.on_hand_quantity != null ? inventory.on_hand_quantity : (variant ? null : 0);
    const descriptionText = this.parseHtmlDescription(apiProduct.description || '');
    const display = resolveVariantDisplayPrice(variant, apiProduct);

    const productName = apiProduct.title || 'Untitled Product';

    this.product = {
      id: apiProduct.product_id,
      slug: String(apiProduct?.slug || this.productSlug || '').trim() || undefined,
      name: productName,
      category: this.resolveCategoryName(
        this.normalizeProductId(apiProduct.category_id),
        this.normalizeProductId(apiProduct.sub_category_id),
        this.normalizeProductId(apiProduct.sub_sub_category_id)
      ),
      rating: 4.5,
      reviews: Math.floor(Math.random() * 5000) + 100,
      sold: Math.floor(Math.random() * 1000) + 50,
      price: display.price,
      originalPrice: display.originalPrice,
      brand: apiProduct.brand || 'Unknown Brand',
      capacity: variant?.description_2 || '',
      material: '', wattage: '',
      images: variantImages,
      aboutItems: this.extractAboutItems(descriptionText),
      description: descriptionText,
      descriptionHtml: this.sanitizer.bypassSecurityTrustHtml(apiProduct.description || ''),
      productInfo: {
        dimensions: '', weight: '', warranty: '',
        manufacturer: apiProduct.brand || 'Unknown',
        memoryStorage: this.selectedSize || ''
      },
      sku: variant?.sku || '',
      barcode: variant?.barcode || '',
      uom: variant?.uom_name || '',
      stock: onHandQty,
      inStock: onHandQty != null ? onHandQty > 0 : true,
      variants: apiProduct.im_ProductVariants || [],
      variantAttributes: variant?.im_VariantAttributes || []
    };
    this.priceCurrencySymbol = display.display_symbol || this.priceCurrencySymbol || '$';
    this.selectedImageIndex = 0;
  }

  findCompatibleVariant(): any {
    if (!this.apiProductData?.im_ProductVariants) return null;
    const variants = this.apiProductData.im_ProductVariants;
    for (const variant of variants) {
      const attributes = variant.im_VariantAttributes || [];
      let matches = true;
      for (const [attrId, valueId] of this.selectedAttributes.entries()) {
        const hasAttribute = attributes.some((attr: any) => attr.attribute_id === attrId && attr.value_id === valueId);
        if (!hasAttribute) { matches = false; break; }
      }
      if (matches) return variant;
    }
    if (this.selectedAttributes.size > 0) {
      const firstAttr = Array.from(this.selectedAttributes.entries())[0];
      for (const variant of variants) {
        const attributes = variant.im_VariantAttributes || [];
        const hasAttribute = attributes.some((attr: any) => attr.attribute_id === firstAttr[0] && attr.value_id === firstAttr[1]);
        if (hasAttribute) {
          attributes.forEach((attr: any) => {
            if (attr.attribute_id && attr.value_id) {
              if (this.variantGroups.find(g => g.attributeId === attr.attribute_id && g.type === 'color')) this.selectedColor = attr.value_id;
              else if (this.variantGroups.find(g => g.attributeId === attr.attribute_id && g.type === 'size')) this.selectedSize = attr.value_id;
              this.selectedAttributes.set(attr.attribute_id, attr.value_id);
            }
          });
          return variant;
        }
      }
    }
    return variants[0] || null;
  }

  getVariantImage(variant: any, apiProduct: any): string {
    if (!variant) return apiProduct?.thumbnail_url || '/mobile.jpg';
    const images = variant.im_ProductImages || [];
    const primaryImage = images.find((img: any) => img.is_primary === 'T') || images[0];
    return primaryImage?.image_url || apiProduct?.thumbnail_url || '/mobile.jpg';
  }

  getVariantPrice(variant: any): number {
    return variant?.base_price || 0;
  }

  isVariantAvailable(variant: any): boolean {
    if (!variant) return false;
    const inventory = variant.im_StoreVariantInventory?.[0];
    if (!inventory || inventory.on_hand_quantity == null) return true;
    return (inventory.on_hand_quantity || 0) > 0;
  }

  getVariantByAttributes(attributeId: string, valueId: string): any {
    if (!this.apiProductData) return null;
    const variants = this.apiProductData.im_ProductVariants || [];
    return variants.find((v: any) =>
      v.im_VariantAttributes?.some((attr: any) => attr.attribute_id === attributeId && attr.value_id === valueId)
    ) || null;
  }

  parseHtmlDescription(html: string): string {
    if (!html) return '';
    // Simple HTML tag removal - you might want to use a proper HTML parser
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  extractAboutItems(description: string): string[] {
    if (!description) return [];
    // Split by line breaks or paragraphs and filter empty strings
    const items = description
      .split(/\n|\. |<p>|<\/p>/)
      .map(item => item.trim())
      .filter(item => item.length > 10 && item.length < 200);
    return items.slice(0, 6); // Limit to 6 items
  }

  getCategoryName(categoryId: string): string {
    return this.resolveCategoryName(
      this.normalizeProductId(categoryId),
      '',
      ''
    );
  }

  onShop(){
    const storeIdForNavigation = this.currentStoreId || this.getStoredStoreId();
    this.router.navigate(['shop-details'], {
      queryParams: {
        store_id: storeIdForNavigation || undefined,
      },
    });
  }

  toggleFollowShop(event?: Event): void {
    event?.stopPropagation();
    const storeId = String(this.shopProfile?.id || this.currentStoreId || '').trim();
    if (!storeId || this.followActionLoading) return;

    const wasFollowing = this.isFollowingShop;
    this.followActionLoading = true;
    this.followService.toggleFollow(storeId, wasFollowing).subscribe({
      next: (result) => {
        this.followActionLoading = false;
        if (result === 'login_required') return;
        this.isFollowingShop = result === true;
        this.refreshFollowersLabel(wasFollowing, this.isFollowingShop);
      },
      error: () => {
        this.followActionLoading = false;
      },
    });
  }

  private loadShopFollowStatus(storeId: string): void {
    const normalizedId = String(storeId || '').trim();
    if (!normalizedId) {
      this.isFollowingShop = false;
      return;
    }

    this.followService.getFollowStatus(normalizedId).subscribe({
      next: (status) => {
        this.isFollowingShop = !!status.is_following;
        if (status.follower_count >= 0) {
          this.shopProfile = {
            ...this.shopProfile,
            followersLabel: this.formatCompactCount(status.follower_count),
          };
        }
      },
    });
  }

  private refreshFollowersLabel(wasFollowing: boolean, isFollowing: boolean): void {
    const current = this.parseCompactCount(this.shopProfile.followersLabel);
    let next = current;
    if (isFollowing && !wasFollowing) next = current + 1;
    if (!isFollowing && wasFollowing) next = Math.max(0, current - 1);
    this.shopProfile = {
      ...this.shopProfile,
      followersLabel: this.formatCompactCount(next),
    };
  }

  private parseCompactCount(label: string): number {
    const raw = String(label || '').trim().toUpperCase();
    if (!raw) return 0;
    if (raw.endsWith('K')) return Math.round(parseFloat(raw) * 1000) || 0;
    if (raw.endsWith('M')) return Math.round(parseFloat(raw) * 1000000) || 0;
    return Math.max(0, Number(raw.replace(/,/g, '')) || 0);
  }

  onProductDetailAdClick(): void {
    const ad = this.currentProductDetailAd;
    if (ad?.raw) {
      this.ads.openShopLink(ad.raw);
    }
  }

  private resolveStoreIdFromRoute(params: any): string {
    const routeStoreId = String(params?.['store_id'] || params?.['storeId'] || '').trim();
    if (routeStoreId) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('store_id', routeStoreId);
      }
      return routeStoreId;
    }
    return this.getStoredStoreId();
  }

  private getStoredStoreId(): string {
    if (typeof window === 'undefined') return '';
    return (
      localStorage.getItem('store_id') ||
      sessionStorage.getItem('store_id') ||
      localStorage.getItem('storeId') ||
      sessionStorage.getItem('storeId') ||
      ''
    ).trim();
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
    return String(candidate || '').trim();
  }

  private loadShopProfileForProduct(productData: any): void {
    const variant = this.getSelectedVariant();
    const productStoreId = this.resolveStoreIdFromProduct(productData, variant);
    const storeIdToLoad = this.currentStoreId || productStoreId || this.getStoredStoreId();

    if (!storeIdToLoad) {
      this.setFallbackShopProfile();
      return;
    }

    this.currentStoreId = storeIdToLoad;
    if (typeof window !== 'undefined') {
      localStorage.setItem('store_id', storeIdToLoad);
    }
    this.api.getstores(storeIdToLoad).subscribe({
      next: (res: any) => {
        const rawStore = res?.data ?? res;
        const storeData = Array.isArray(rawStore) ? rawStore[0] : rawStore;

        const storeRegion = resolveStoreAddressRegion(storeData);
        const productRegion = resolveStoreRegionFromProduct(productData);
        const atoll = storeRegion.atoll || productRegion.atoll;
        const city = storeRegion.city || productRegion.city;
        const locationLabel =
          formatShopLocation(atoll, city) ||
          String(storeData?.store_location || storeData?.location || '').trim();

        this.shopProfile = {
          id: String(
            storeData?.store_id ??
            storeData?.storeId ??
            storeIdToLoad
          ),
          name:
            storeData?.store_name ||
            storeData?.name ||
            storeData?.store ||
            'Unknown Shop',
          logo:
            storeData?.logo ||
            storeData?.logo_url ||
            storeData?.image ||
            productData?.store_logo ||
            productData?.logo ||
            productData?.logo_url ||
            productData?.image ||
            '/store.jpg',
          totalProducts: this.formatCompactCount(
            storeData?.total_products ??
            storeData?.products_count ??
            storeData?.product_count ??
            0
          ),
          rating: Number(storeData?.rating || storeData?.average_rating || 0),
          reviewsLabel: this.formatCompactCount(
            storeData?.reviews ??
            storeData?.review_count ??
            storeData?.total_reviews ??
            0
          ),
          responseRate: storeData?.response_rate ? `${storeData.response_rate}%` : '',
          responseTime: storeData?.response_time || '',
          itemsSoldLabel: this.formatCompactCount(
            storeData?.items_sold ??
            storeData?.total_sold ??
            storeData?.sold_count ??
            0
          ),
          followersLabel: this.formatCompactCount(
            storeData?.followers ??
            storeData?.follower_count ??
            0
          ),
          atoll,
          city,
          location: locationLabel,
          isApiData: true,
        };
        this.loadShopFollowStatus(storeIdToLoad);
        this.priceCurrencySymbol =
          resolveCurrencySymbol(storeData?.default_currency) ||
          this.priceCurrencySymbol ||
          '$';
        if (this.apiProductData) {
          const variant = this.getSelectedVariant();
          const display = resolveVariantDisplayPrice(variant, this.apiProductData);
          this.priceCurrencySymbol = display.display_symbol || this.priceCurrencySymbol;
          this.apiProductData = {
            ...this.apiProductData,
            store_currency_code:
              display.display_currency ||
              String(storeData?.default_currency || '').trim().toUpperCase(),
            store_currency_symbol: this.priceCurrencySymbol,
          };
        }
      },
      error: () => {
        const productRegion = resolveStoreRegionFromProduct(productData);
        this.shopProfile = {
          id: storeIdToLoad,
          name:
            productData?.store_name ||
            productData?.store ||
            'Unknown Shop',
          logo:
            productData?.store_logo ||
            productData?.logo ||
            productData?.logo_url ||
            productData?.image ||
            '/store.jpg',
          totalProducts: this.formatCompactCount(
            productData?.total_products ??
            productData?.products_count ??
            productData?.product_count ??
            0
          ),
          rating: Number(productData?.rating || productData?.average_rating || 0),
          reviewsLabel: this.formatCompactCount(
            productData?.reviews ??
            productData?.review_count ??
            productData?.total_reviews ??
            0
          ),
          responseRate: productData?.response_rate ? `${productData.response_rate}%` : '',
          responseTime: productData?.response_time || '',
          itemsSoldLabel: this.formatCompactCount(
            productData?.items_sold ??
            productData?.total_sold ??
            productData?.sold_count ??
            0
          ),
          followersLabel: this.formatCompactCount(
            productData?.followers ??
            productData?.follower_count ??
            0
          ),
          atoll: productRegion.atoll,
          city: productRegion.city,
          location: formatShopLocation(productRegion.atoll, productRegion.city),
          isApiData: true,
        };
        this.loadShopFollowStatus(storeIdToLoad);
        this.priceCurrencySymbol = '$';
        if (this.apiProductData) {
          this.apiProductData = {
            ...this.apiProductData,
            store_currency_symbol: '$',
          };
        }
      },
    });
  }

  private setFallbackShopProfile(storeId: string = ''): void {
    this.shopProfile = {
      id: storeId,
      name: 'Shop information unavailable',
      logo: '/store.jpg',
      totalProducts: '0',
      rating: 0,
      reviewsLabel: '0',
      responseRate: '',
      responseTime: '',
      itemsSoldLabel: '',
      followersLabel: '',
      atoll: '',
      city: '',
      location: '',
      isApiData: false,
    };
  }

  private formatCompactCount(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0';
    if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1).replace('.0', '')}M+`;
    if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1).replace('.0', '')}k+`;
    return `${Math.floor(numeric)}`;
  }

  selectImage(index: number) {
    if (!this.product?.images?.length) return;
    const total = this.product.images.length;
    this.selectedImageIndex = ((index % total) + total) % total;
  }

  goToPreviousMedia(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.selectImage(this.selectedImageIndex - 1);
  }

  goToNextMedia(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.selectImage(this.selectedImageIndex + 1);
  }

  isVideoMedia(url: string | null | undefined): boolean {
    if (!url) return false;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  }

  muteProductVideo(video: HTMLVideoElement | null | undefined): void {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
  }

  private getPreferredCartImage(): string {
    const variant = this.getSelectedVariant();
    const variantImages = Array.isArray(variant?.im_ProductImages)
      ? variant.im_ProductImages
      : [];
    const primaryVariantImage =
      variantImages.find((img: any) => img?.is_primary === 'T') || variantImages[0];
    if (primaryVariantImage?.image_url) {
      return primaryVariantImage.image_url;
    }

    const media = this.product?.images || [];
    const firstImage = media.find((item: string) => !this.isVideoMedia(item));
    if (firstImage) return firstImage;
    return media[this.selectedImageIndex] || media[0] || '/mobile.jpg';
  }

  increaseQuantity() {
    this.quantity++;
  }

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }


  addToCart(event?: Event) {
    if (!this.product) return;

    if (!this.areAllRequiredVariantsSelected()) {
      this.openCartModal('add');
      return;
    }

    const productId = String(this.product.id ?? '');
    if (!productId) return;

    const variant = this.getSelectedVariant();
    const selectedAttributes: Record<string, string> = {};
    this.variantGroups.forEach((g: any) => {
      const valueId = this.selectedAttributes.get(g.attributeId);
      if (valueId) selectedAttributes[g.attributeId] = valueId;
    });
    const variantId = this.cartService.resolveVariantId(variant, selectedAttributes);
    const existing = this.cartService.findItem(productId, variantId);

    // Same product + same variant already in cart → open modal with current qty.
    if (existing) {
      this.openCartModal('add');
      return;
    }

    this.persistSelectedVariantToCart(event);
  }

  private persistSelectedVariantToCart(event?: Event): void {
    const productId = String(this.product.id ?? '');
    if (!productId) return;

    const variant = this.getSelectedVariant();
    const labelParts: string[] = [];
    const selectedAttributes: Record<string, string> = {};
    this.variantGroups.forEach((g: any) => {
      const valueId = this.selectedAttributes.get(g.attributeId);
      if (valueId) {
        selectedAttributes[g.attributeId] = valueId;
        labelParts.push(`${g.label}: ${this.getValueDisplayLabel(valueId)}`);
      }
    });
    const variantId = this.cartService.resolveVariantId(variant, selectedAttributes);

    const image = this.getPreferredCartImage();
    this.cartService.addItem(
      {
        id: productId,
        slug: this.product?.slug || this.productSlug || undefined,
        variantId,
        variantLabel: labelParts.join(' · '),
        name: this.product.name || 'Untitled Product',
        price: Number(this.product.price) || 0,
        originalPrice: Number(this.product.originalPrice) || 0,
        image,
        quantity: this.quantity > 0 ? this.quantity : 1,
        inStock: this.product.inStock !== false,
        store_id: this.currentStoreId || undefined,
        store_name: this.shopProfile?.name,
        shop_location: this.shopProfile?.location,
        store_currency_code: this.apiProductData?.default_currency,
        store_currency_symbol: this.priceCurrencySymbol,
        selectedAttributes,
      },
      this.quantity > 0 ? this.quantity : 1
    );

    this.actionFeedback.feedback(event, 'cart', { image });
  }

  toggleFavorite(event?: Event) {
    if (!this.product) return;
    const result = this.favoritesService.toggle(
      this.favoritesService.fromDetailsProduct(
        this.product,
        this.getPreferredCartImage(),
        this.currentStoreId
      )
    );
    if (result === 'login_required') return;
    this.actionFeedback.feedback(event, 'favorite', {
      added: result,
      image: this.getPreferredCartImage(),
    });
  }

  isFavoriteProduct(): boolean {
    return this.favoritesService.isFavorite(this.product?.id);
  }

  private getStoredCartItems(): any[] {
    return this.cartService.getItems();
  }

  toggleShareMenu() {
    this.isShareOpen = !this.isShareOpen;
  }

  closeShareMenu() {
    this.isShareOpen = false;
  }

  get shareUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  }

  copyLink() {
    this.shareUrl && navigator.clipboard?.writeText(this.shareUrl).then(() => {
      this.closeShareMenu();
    });
  }

  shareViaEmail() {
    const subject = encodeURIComponent(this.product?.name || 'Product');
    const body = encodeURIComponent(`${this.product?.name || 'Product'}\n${this.shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    this.closeShareMenu();
  }

  shareToPinterest() {
    const url = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(this.shareUrl)}&description=${encodeURIComponent(this.product?.name || '')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    this.closeShareMenu();
  }

  shareToFacebook() {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    this.closeShareMenu();
  }

  shareToX() {
    const text = encodeURIComponent(this.product?.name || '');
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.shareUrl)}&text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    this.closeShareMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.isShareOpen && !target.closest('.share-dropdown-trigger') && !target.closest('.share-dropdown-menu')) {
      this.closeShareMenu();
    }
  }
}
