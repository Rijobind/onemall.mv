import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { BackendapiServices } from "../../../../core/services/backendapi.services/backendapi.services";
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-product-details',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css',
})
export class ProductDetails implements OnInit {

  
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
      if (this.productId) {
        this.isLoading = true;
        this.loadProduct(this.productId);
      } else {
        this.isLoading = false;
      }
    });
  }

  loadProduct(productId: string) {
    this.api.getAllProductList().subscribe({
      next: (res: any) => {
        const products = res.data || [];
        const productData = products.find((p: any) => p.product_id === productId);
        if (productData) {
          this.transformProductData(productData);
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  transformProductData(apiProduct: any) {
    this.apiProductData = apiProduct;
    this.initializeVariants(apiProduct);
    const variant = this.getSelectedVariant();
    this.updateProductFromVariant(variant, apiProduct);
  }

  initializeVariants(apiProduct: any) {
    const variants = apiProduct.im_ProductVariants || [];
    this.attributeLabels.clear();
    this.valueLabels.clear();
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
              const desc2 = v.description_2;
              if (desc2 && desc2.trim()) {
                if (v.im_VariantAttributes.length === 1 && desc2.length <= 40) {
                  this.valueLabels.set(attr.value_id, desc2.trim());
                } else {
                  this.valueLabels.set(attr.value_id, desc2.length > 20 ? desc2.slice(0, 18) + '…' : desc2);
                }
              } else {
                this.valueLabels.set(attr.value_id, attr.value_id?.length > 12 ? attr.value_id.slice(0, 8) + '…' : (attr.value_id || ''));
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

    let productName = apiProduct.title || 'Untitled Product';
    if (this.selectedSize) productName += ` ${this.selectedSize}`;
    if (this.selectedColor && this.selectedColor !== 'Default') productName += ` (${this.selectedColor})`;

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
    this.router.navigate(['shop-details'])
  }

  selectImage(index: number) {
    this.selectedImageIndex = index;
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
    // Add to cart logic
    console.log('Added to cart:', this.product);
  }

  buyNow() {
    // Buy now logic
    console.log('Buy now:', this.product);
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
