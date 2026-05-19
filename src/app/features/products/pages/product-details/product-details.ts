import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { BackendapiServices } from "../../../../core/services/backendapi.services/backendapi.services";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-product-details',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css',
})
export class ProductDetails implements OnInit {
  private readonly cartStorageKey = 'cart_items';
  qtyOptions: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  
  productId: string | null = null;
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
  attributeLabels: Map<string, string> = new Map();
  valueLabels: Map<string, string> = new Map();
  colorCodes: Map<string, string> = new Map();
  currentStoreId: string = '';
  shopProfile = {
    id: '',
    name: 'Unknown Shop',
    logo: '/shirt.jpg',
    rating: 0,
    reviewsLabel: '0',
    responseRate: '',
    responseTime: '',
    itemsSoldLabel: '',
    followersLabel: '',
    isApiData: false,
  };

  get colorGroup() {
    return this.variantGroups.find((g: any) => g.type === 'color');
  }

  get sizeGroup() {
    return this.variantGroups.find((g: any) => g.type === 'size');
  }

  product: any = {
    id: 1,
    name: '3Dconnexion 3DX-700040 SpaceMouse Pro 3D - Professional 3D Navigation Tool for CAD and Design',
    category: 'Consumer Electronics',
    rating: 4.5,
    reviews: 1738,
    sold: 349,
    price: 64.50,
    originalPrice: 80.40,
    brand: 'Elite Gourmet',
    capacity: '1 Liters',
    material: 'Glass',
    wattage: '1100 watts',
    images: [
      '/shoe3.jpg',
      '/shirt.jpg',
      '/shirt2.jpg',
      '/shirts.jpg',
      '/glass.jpg',
      '/keyboard.jpg'
    ],
    aboutItems: [
      "Here's the quickest way to enjoy your delicious hot tea every single day.",
      "100% BPA-Free premium design meets excellent",
      "No more messy accidents or spills",
      "So easy & convenient that everyone can use it",
      "This powerful 900-1100-Watt kettle has convenient capacity markings on the body lets you accurately",
      "1 year limited warranty and us-based customer support team lets you buy with confidence."
    ],
    description: "Experience professional-grade 3D navigation with the SpaceMouse Pro. Perfect for CAD designers and 3D professionals who need precise control and intuitive navigation in their 3D workspace.",
    productInfo: {
      dimensions: "12 x 8 x 4 inches",
      weight: "2.5 pounds",
      warranty: "1 year limited warranty",
      manufacturer: "3Dconnexion"
    }
  };

  similarProducts = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg'
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg'
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg'
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg'
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg'
    }
  ];

  reviewBreakdown = [
    { label: 'Small', percent: 0 },
    { label: 'True to size', percent: 0 },
    { label: 'Large', percent: 100 },
  ];

  productReviews = [
    {
      user: 'N*** ut',
      country: 'FR',
      date: 'May 14, 2026',
      rating: 5,
      text: "They're lightweight and comfortable, with good cushioning, but they run a bit large.",
      purchasedCount: 0,
      relatedText: '',
    },
  ];

  activeTab: string = 'description';
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: BackendapiServices,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.productId = params['productId'];
      this.currentStoreId = this.resolveStoreIdFromRoute(params);
      if (this.productId) {
        this.isLoading = true;
        this.loadProduct(this.productId);
      } else {
        this.isLoading = false;
      }
    });
  }

  loadProduct(productId: string) {
    // Prefer multilevel endpoint; fallback to single endpoint for compatibility.
    this.loadProductFromSource(this.api.getMultilevelProductDetails(productId), productId, true);
  }

  private loadProductFromSource(
    request$: Observable<any>,
    productId: string,
    allowSingleFallback: boolean
  ) {
    request$.subscribe({
      next: (res: any) => {
        // Accept common backend response shapes:
        // 1) { data: { ...product } }
        // 2) { data: [ { ...product } ] }
        // 3) raw product object
        // 4) stringified JSON
        const rawPayload = res?.data ?? res;
        let productData: any = rawPayload;

        if (typeof rawPayload === 'string') {
          try {
            productData = JSON.parse(rawPayload);
          } catch {
            productData = null;
          }
        }

        if (Array.isArray(productData)) {
          productData = productData[0] || null;
        }

        if (productData) {
          this.transformProductData(productData);
          this.loadShopProfileForProduct(productData);
        } else if (allowSingleFallback) {
          this.loadProductFromSource(this.api.getProductDetails(productId), productId, false);
          return;
        } else {
          console.warn('[ProductDetails] No product found for productId:', productId, res);
        }
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        if (allowSingleFallback && err?.status === 404) {
          this.loadProductFromSource(this.api.getProductDetails(productId), productId, false);
          return;
        }

        if (err?.status === 401 || err?.status === 403) {
          console.error('[ProductDetails] Authorization failed for product details API. Check access token/session.', err);
        } else {
          console.error('[ProductDetails] getProductDetails error:', err);
        }
        this.isLoading = false;
      }
    });
  }

  transformProductData(apiProduct: any) {
    this.apiProductData = apiProduct;
    this.initializeVariants(apiProduct);
    const variant = this.getSelectedVariant();
    this.updateProductFromVariant(variant, apiProduct);
    if (!this.currentStoreId) {
      this.currentStoreId = this.resolveStoreIdFromProduct(apiProduct, variant);
    }
  }

  initializeVariants(apiProduct: any) {
    const variants = apiProduct.im_ProductVariants || [];
    this.attributeLabels.clear();
    this.valueLabels.clear();
    this.colorCodes.clear();
    this.variantGroups = [];

    if (variants.length === 0) return;

    const attributeMap = new Map<string, Set<string>>();
    variants.forEach((v: any) => {
      if (v.im_VariantAttributes && v.im_VariantAttributes.length > 0) {
        v.im_VariantAttributes.forEach((attr: any) => {
          if (attr.attribute_id && attr.value_id) {
            if (!attributeMap.has(attr.attribute_id)) {
              attributeMap.set(attr.attribute_id, new Set());
            }
            attributeMap.get(attr.attribute_id)!.add(attr.value_id);
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
    const typeNames = ['color', 'size', 'style', 'material', 'option'];
    attributeIds.forEach((attrId, idx) => {
      this.attributeLabels.set(attrId, typeNames[idx] || `Option ${idx + 1}`);
    });

    if (attributeIds.length > 0) {
      const colorAttrId = attributeIds[0];
      const colorValues = Array.from(attributeMap.get(colorAttrId) || []);
      this.colors = colorValues;
      const firstVariantWithAttr = variants.find((v: any) => v.im_VariantAttributes?.some((a: any) => a.attribute_id === colorAttrId));
      const firstColorAttr = firstVariantWithAttr?.im_VariantAttributes?.find((a: any) => a.attribute_id === colorAttrId);
      this.selectedColor = firstColorAttr?.value_id || colorValues[0] || '';
      this.selectedAttributes.set(colorAttrId, this.selectedColor);
    }

    if (attributeIds.length > 1) {
      const sizeAttrId = attributeIds[1];
      const sizeValues = Array.from(attributeMap.get(sizeAttrId) || []);
      this.sizes = sizeValues;
      const firstVariantWithSize = variants.find((v: any) => v.im_VariantAttributes?.some((a: any) => a.attribute_id === sizeAttrId));
      const firstSizeAttr = firstVariantWithSize?.im_VariantAttributes?.find((a: any) => a.attribute_id === sizeAttrId);
      this.selectedSize = firstSizeAttr?.value_id || sizeValues[0] || '';
      this.selectedAttributes.set(sizeAttrId, this.selectedSize);
    }

    this.variantGroups = attributeIds.map((attrId, idx) => ({
      attributeId: attrId,
      values: Array.from(attributeMap.get(attrId) || []),
      type: typeNames[idx] || 'other',
      label: this.attributeLabels.get(attrId) || `Option ${idx + 1}`
    }));
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

    const valueLooksLikeHex = this.isHexColor(value);
    const colorNameLooksLikeHex = this.isHexColor(colorName);

    // Prefer non-hex, human-readable labels.
    if (value && !valueLooksLikeHex) return value;
    if (colorName && !colorNameLooksLikeHex) return colorName;
    if (value) return value;
    if (colorName) return colorName;
    return '';
  }

  private isHexColor(text: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((text || '').trim());
  }

  onAttributeSelect(attributeId: string, valueId: string) {
    if (this.variantGroups.find((g: any) => g.attributeId === attributeId)?.type === 'color') {
      this.selectedColor = valueId;
    } else if (this.variantGroups.find((g: any) => g.attributeId === attributeId)?.type === 'size') {
      this.selectedSize = valueId;
    }
    this.selectedAttributes.set(attributeId, valueId);
    const variant = this.findCompatibleVariant();
    if (variant && this.apiProductData) this.updateProductFromVariant(variant, this.apiProductData);
  }

  isAttributeValueSelected(attributeId: string, valueId: string): boolean {
    return this.selectedAttributes.get(attributeId) === valueId;
  }

  getSelectedVariant(): any {
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
    return variants[0] || null;
  }

  updateProductFromVariant(variant: any, apiProduct: any) {
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
    if (thumbnail && !variantImages.includes(thumbnail)) variantImages.unshift(thumbnail);
    if (variantImages.length === 0) variantImages.push(apiProduct?.thumbnail_url || '/mobile.jpg');

    const inventory = variant?.im_StoreVariantInventory?.[0];
    const onHandQty = inventory?.on_hand_quantity != null ? inventory.on_hand_quantity : (variant ? null : 0);
    const descriptionText = this.parseHtmlDescription(apiProduct.description || '');

    const productName = apiProduct.title || 'Untitled Product';

    this.product = {
      id: apiProduct.product_id,
      name: productName,
      category: this.getCategoryName(apiProduct.category_id),
      rating: 4.5,
      reviews: Math.floor(Math.random() * 5000) + 100,
      sold: Math.floor(Math.random() * 1000) + 50,
      price: variant?.base_price ?? 0,
      originalPrice: variant?.base_price && variant.base_price > 0 ? Math.round(variant.base_price * 1.2 * 100) / 100 : 0,
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
    // This would ideally fetch from category list
    // For now, return a placeholder
    return 'Product Category';
  }

  onShop(){
    const storeIdForNavigation = this.currentStoreId || this.getStoredStoreId();
    this.router.navigate(['shop-details'], {
      queryParams: {
        store_id: storeIdForNavigation || undefined,
      },
    });
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

    this.api.Store_details(storeIdToLoad).subscribe({
      next: (res: any) => {
        const payload = res?.data ?? res ?? {};
        this.shopProfile = {
          id: String(
            payload?.store_id ??
            payload?.storeId ??
            storeIdToLoad
          ),
          name: payload?.store_name || payload?.name || 'Unknown Shop',
          logo: payload?.logo || payload?.logo_url || payload?.image || '/shirt.jpg',
          rating: Number(payload?.rating || payload?.average_rating || 0),
          reviewsLabel: this.formatCompactCount(
            payload?.reviews ??
            payload?.review_count ??
            payload?.total_reviews ??
            0
          ),
          responseRate: payload?.response_rate ? `${payload.response_rate}%` : '',
          responseTime: payload?.response_time || '',
          itemsSoldLabel: this.formatCompactCount(
            payload?.items_sold ??
            payload?.total_sold ??
            payload?.sold_count ??
            0
          ),
          followersLabel: this.formatCompactCount(
            payload?.followers ??
            payload?.follower_count ??
            0
          ),
          isApiData: true,
        };
      },
      error: () => {
        this.setFallbackShopProfile(storeIdToLoad);
      },
    });
  }

  private setFallbackShopProfile(storeId: string = ''): void {
    this.shopProfile = {
      id: storeId,
      name: 'Shop information unavailable',
      logo: '/shirt.jpg',
      rating: 0,
      reviewsLabel: '0',
      responseRate: '',
      responseTime: '',
      itemsSoldLabel: '',
      followersLabel: '',
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

  private getPreferredCartImage(): string {
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


  addToCart() {
    if (!this.product) return;

    const productId = String(this.product.id ?? '');
    if (!productId) return;

    const cartItem = {
      id: productId,
      name: this.product.name || 'Untitled Product',
      price: Number(this.product.price) || 0,
      originalPrice: Number(this.product.originalPrice) || 0,
      image:
        this.getPreferredCartImage(),
      quantity: this.quantity > 0 ? this.quantity : 1,
      inStock: this.product.inStock !== false,
    };

    const existingItems = this.getStoredCartItems();
    const existingIndex = existingItems.findIndex(
      (item: any) => String(item.id) === productId
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex].quantity =
        (Number(existingItems[existingIndex].quantity) || 0) + cartItem.quantity;
      existingItems[existingIndex].price = cartItem.price;
      existingItems[existingIndex].originalPrice = cartItem.originalPrice;
      existingItems[existingIndex].image = cartItem.image;
      existingItems[existingIndex].inStock = cartItem.inStock;
      existingItems[existingIndex].name = cartItem.name;
    } else {
      existingItems.push(cartItem);
    }

    localStorage.setItem(this.cartStorageKey, JSON.stringify(existingItems));
    window.dispatchEvent(new Event('cart-updated'));
  }

  buyNow() {
    this.addToCart();
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
