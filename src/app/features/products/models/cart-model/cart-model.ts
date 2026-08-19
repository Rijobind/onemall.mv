import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../../../core/services/cart.service/cart.service';
import { ActionFeedbackService } from '../../../../core/services/action-feedback.service/action-feedback.service';
import { resolveCurrencySymbol } from '../../../../core/utils/marketplace-shop.util';
import { resolveVariantDisplayPrice } from '../../../../core/utils/marketplace-price.util';

export type CartModelMode = 'add';

@Component({
  selector: 'app-cart-model',
  imports: [CommonModule, FormsModule],
  templateUrl: './cart-model.html',
  styleUrl: './cart-model.css',
})
export class CartModel implements OnChanges {
  @Input() isOpen = false;
  @Input() apiProduct: any = null;
  @Input() mode: CartModelMode = 'add';
  /** Pre-selected attribute value ids keyed by attribute id. */
  @Input() initialAttributes: Record<string, string> | null = null;
  @Input() initialQuantity = 1;
  @Input() storeId = '';

  @Output() closed = new EventEmitter<void>();
  @Output() added = new EventEmitter<{ quantity: number; image: string }>();

  qtyOptions: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  quantity = 1;
  selectedImageIndex = 0;
  showValidation = false;
  /** True when the selected product + variant is already a cart line. */
  alreadyInCart = false;
  existingCartQuantity = 0;

  variantGroups: any[] = [];
  selectedAttributes = new Map<string, string>();
  attributeLabels = new Map<string, string>();
  valueLabels = new Map<string, string>();
  colorCodes = new Map<string, string>();

  displayImages: string[] = [];
  displayPrice = 0;
  displayOriginalPrice = 0;
  displayName = '';
  displaySold = 0;
  displayStock: number | null = null;
  displayCurrencySymbol = '$';

  get colorGroup() {
    return this.variantGroups.find((g: any) => g.type === 'color');
  }

  get sizeGroup() {
    return this.variantGroups.find((g: any) => g.type === 'size');
  }

  get otherGroups() {
    return this.variantGroups.filter(
      (g: any) => g.type !== 'color' && g.type !== 'size'
    );
  }

  get hasVariantOptions(): boolean {
    return this.variantGroups.length > 0;
  }

  get missingRequiredGroups(): any[] {
    return this.variantGroups.filter(
      (g: any) => !this.selectedAttributes.get(g.attributeId)
    );
  }

  get allOptionsSelected(): boolean {
    if (!this.hasVariantOptions) return true;
    return this.missingRequiredGroups.length === 0;
  }

  get discountPercent(): number {
    if (!this.displayOriginalPrice || this.displayOriginalPrice <= this.displayPrice) {
      return 0;
    }
    return Math.round(
      ((this.displayOriginalPrice - this.displayPrice) / this.displayOriginalPrice) * 100
    );
  }

  get primaryButtonLabel(): string {
    if (!this.allOptionsSelected) return 'Select an option';
    return this.alreadyInCart ? 'Update cart' : 'Add to cart';
  }

  constructor(
    private cartService: CartService,
    private actionFeedback: ActionFeedbackService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] || changes['apiProduct']) {
      if (this.isOpen && this.apiProduct) {
        this.bootstrapFromProduct();
      }
    }
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) this.close();
  }

  close(): void {
    document.body.style.overflow = '';
    this.showValidation = false;
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  selectImage(index: number): void {
    if (!this.displayImages.length) return;
    const total = this.displayImages.length;
    this.selectedImageIndex = ((index % total) + total) % total;
  }

  onAttributeSelect(attributeId: string, valueId: string): void {
    if (!this.isAttributeValueAvailable(attributeId, valueId)) return;
    this.selectedAttributes.set(attributeId, valueId);
    this.showValidation = false;
    this.refreshDisplayFromSelection();
    this.syncAlreadyInCartState();
  }

  isAttributeValueSelected(attributeId: string, valueId: string): boolean {
    return this.selectedAttributes.get(attributeId) === valueId;
  }

  isAttributeValueAvailable(attributeId: string, valueId: string): boolean {
    const variants = this.apiProduct?.im_ProductVariants || [];
    if (!Array.isArray(variants) || variants.length === 0) return true;

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

  getValueDisplayLabel(valueId: string): string {
    return (
      this.valueLabels.get(valueId) ||
      (valueId?.length > 12 ? valueId.slice(0, 8) + '…' : valueId) ||
      ''
    );
  }

  getSelectedValueLabelByType(type: string): string {
    const group = this.variantGroups.find((g: any) => g.type === type);
    if (!group) return '';
    const valueId = this.selectedAttributes.get(group.attributeId) || '';
    return this.getValueDisplayLabel(valueId);
  }

  getColorCodeByValue(valueId: string): string {
    const explicit = this.colorCodes.get(valueId);
    if (explicit) return explicit;
    const label = String(this.getValueDisplayLabel(valueId) || '').trim();
    if (!label) return '#d1d5db';
    if (typeof document !== 'undefined') {
      const tester = document.createElement('span');
      tester.style.color = '';
      tester.style.color = label.toLowerCase();
      if (tester.style.color) return label.toLowerCase();
    }
    return '#d1d5db';
  }

  getSelectedColorCode(): string {
    if (!this.colorGroup) return '#d1d5db';
    const selectedValueId =
      this.selectedAttributes.get(this.colorGroup.attributeId) || '';
    return this.getColorCodeByValue(selectedValueId);
  }

  getColorOptionImage(valueId: string): string {
    if (!this.apiProduct || !this.colorGroup) {
      return this.displayImages[0] || '/mobile.jpg';
    }
    const colorAttrId = this.colorGroup.attributeId;
    const sizeAttrId = this.sizeGroup?.attributeId;
    const selectedSizeValue = sizeAttrId
      ? this.selectedAttributes.get(sizeAttrId)
      : '';
    const variants = this.apiProduct.im_ProductVariants || [];

    const colorMatched = variants.filter((v: any) =>
      v.im_VariantAttributes?.some(
        (attr: any) => attr.attribute_id === colorAttrId && attr.value_id === valueId
      )
    );
    if (colorMatched.length === 0) return this.displayImages[0] || '/mobile.jpg';

    const exactVariant = selectedSizeValue
      ? colorMatched.find((v: any) =>
          v.im_VariantAttributes?.some(
            (attr: any) =>
              attr.attribute_id === sizeAttrId && attr.value_id === selectedSizeValue
          )
        )
      : null;

    return this.getVariantImage(exactVariant || colorMatched[0]);
  }

  confirm(event?: Event): void {
    if (!this.allOptionsSelected) {
      this.showValidation = true;
      return;
    }
    if (!this.apiProduct) return;

    const variant = this.resolveSelectedVariant();
    const productId = String(
      this.apiProduct.product_id ?? this.apiProduct.id ?? ''
    );
    if (!productId) return;

    const selectedAttributes: Record<string, string> = {};
    const labelParts: string[] = [];
    this.variantGroups.forEach((g: any) => {
      const valueId = this.selectedAttributes.get(g.attributeId);
      if (valueId) {
        selectedAttributes[g.attributeId] = valueId;
        labelParts.push(`${g.label}: ${this.getValueDisplayLabel(valueId)}`);
      }
    });

    const variantId = this.cartService.resolveVariantId(variant, selectedAttributes);
    const image = this.resolveCartImage(variant);
    const inventory = variant?.im_StoreVariantInventory?.[0];
    const onHandQty =
      inventory?.on_hand_quantity != null ? Number(inventory.on_hand_quantity) : null;

    const storeId =
      this.storeId ||
      String(
        this.apiProduct?.store_id ??
          this.apiProduct?.storeId ??
          variant?.im_StoreVariantInventory?.[0]?.store_id ??
          ''
      );

    const existing = this.cartService.findItem(productId, variantId);
    const quantityMode = existing ? 'set' : 'add';

    this.cartService.addItem(
      {
        id: productId,
        variantId,
        variantLabel: labelParts.join(' · '),
        name: this.displayName,
        price: this.displayPrice,
        originalPrice: this.displayOriginalPrice,
        image,
        quantity: this.quantity,
        inStock: onHandQty != null ? onHandQty > 0 : true,
        store_id: storeId || undefined,
        store_name: this.apiProduct?.store_name || this.apiProduct?.storeName,
        shop_location: this.apiProduct?.shop_location,
        store_currency_code: this.apiProduct?.store_currency_code || this.apiProduct?.default_currency,
        store_currency_symbol:
          this.apiProduct?.store_currency_symbol ||
          resolveCurrencySymbol(this.apiProduct?.store_currency_code || this.apiProduct?.default_currency),
        selectedAttributes,
      },
      this.quantity,
      { quantityMode }
    );

    this.actionFeedback.feedback(event, 'cart', { image });
    this.added.emit({ quantity: this.quantity, image });
    this.close();
  }

  private bootstrapFromProduct(): void {
    this.quantity = Math.max(1, Number(this.initialQuantity) || 1);
    this.selectedImageIndex = 0;
    this.showValidation = false;
    this.alreadyInCart = false;
    this.existingCartQuantity = 0;
    this.ensureQtyOptions(this.quantity);
    this.initializeVariants(this.apiProduct);

    if (this.initialAttributes) {
      Object.entries(this.initialAttributes).forEach(([attrId, valueId]) => {
        if (attrId && valueId) {
          this.selectedAttributes.set(attrId, valueId);
        }
      });
    }

    this.refreshDisplayFromSelection();
    this.syncAlreadyInCartState();
  }

  /** When options are fully selected, detect an existing cart line and prefill qty. */
  private syncAlreadyInCartState(): void {
    if (!this.apiProduct || !this.allOptionsSelected) {
      this.alreadyInCart = false;
      this.existingCartQuantity = 0;
      return;
    }

    const productId = String(
      this.apiProduct.product_id ?? this.apiProduct.id ?? ''
    );
    if (!productId) {
      this.alreadyInCart = false;
      this.existingCartQuantity = 0;
      return;
    }

    const selectedAttributes: Record<string, string> = {};
    this.selectedAttributes.forEach((valueId, attrId) => {
      if (attrId && valueId) selectedAttributes[attrId] = valueId;
    });

    const variant = this.resolveSelectedVariant();
    const existing = this.cartService.findItemByAttributes(
      productId,
      selectedAttributes,
      variant
    );

    if (existing) {
      const cartQty = Math.max(1, Number(existing.quantity) || 1);
      this.alreadyInCart = true;
      this.existingCartQuantity = cartQty;
      this.ensureQtyOptions(cartQty);
      this.quantity = cartQty;
    } else {
      const wasAlreadyInCart = this.alreadyInCart;
      this.alreadyInCart = false;
      this.existingCartQuantity = 0;
      if (wasAlreadyInCart) {
        this.quantity = Math.max(1, Number(this.initialQuantity) || 1);
      }
    }
  }

  private ensureQtyOptions(minQty: number): void {
    const needed = Math.max(10, Math.ceil(Number(minQty) || 1) + 5);
    if (this.qtyOptions.length >= needed) return;
    this.qtyOptions = Array.from({ length: needed }, (_, i) => i + 1);
  }

  private refreshDisplayFromSelection(): void {
    const variant = this.resolveSelectedVariant();
    const images = this.collectVariantImages(variant);
    const thumb = this.apiProduct?.thumbnail_url;
    // Keep product thumbnail as a fallback only — never ahead of variant images.
    if (thumb && !images.includes(thumb)) {
      images.push(thumb);
    }
    if (images.length === 0) images.push('/mobile.jpg');

    this.displayImages = images;
    this.selectedImageIndex = 0;
    this.displayName = this.apiProduct?.title || this.apiProduct?.name || 'Untitled Product';
    const display = resolveVariantDisplayPrice(variant, this.apiProduct);
    this.displayPrice = display.price;
    this.displayOriginalPrice = display.originalPrice;
    this.displayCurrencySymbol =
      display.display_symbol ||
      this.apiProduct?.store_currency_symbol ||
      resolveCurrencySymbol(
        display.display_currency ||
          this.apiProduct?.store_currency_code ||
          this.apiProduct?.default_currency
      );
    this.displaySold = Math.floor(Math.random() * 1000) + 20;

    const inventory = variant?.im_StoreVariantInventory?.[0];
    this.displayStock =
      inventory?.on_hand_quantity != null ? Number(inventory.on_hand_quantity) : null;
  }

  private resolveSelectedVariant(): any {
    const variants = this.apiProduct?.im_ProductVariants || [];
    if (!variants.length) return null;

    if (this.selectedAttributes.size === 0) {
      return variants[0];
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
    return variants[0];
  }

  private collectVariantImages(variant: any): string[] {
    const images: string[] = [];
    const list = variant?.im_ProductImages || [];
    // Prefer primary variant image first.
    const sorted = [...list].sort((a: any, b: any) => {
      const aPrimary = a?.is_primary === 'T' ? 0 : 1;
      const bPrimary = b?.is_primary === 'T' ? 0 : 1;
      return aPrimary - bPrimary;
    });
    sorted.forEach((img: any) => {
      if (img?.image_url && !images.includes(img.image_url)) {
        images.push(img.image_url);
      }
    });
    return images;
  }

  /** Cart thumbnail must be the selected variant image, not the product main image. */
  private resolveCartImage(variant: any): string {
    const variantImages = this.collectVariantImages(variant);
    const selected = this.displayImages[this.selectedImageIndex];
    if (selected && variantImages.includes(selected)) {
      return selected;
    }
    if (variantImages.length > 0) {
      return variantImages[0];
    }
    return (
      this.getVariantImage(variant) ||
      this.apiProduct?.thumbnail_url ||
      '/mobile.jpg'
    );
  }

  private getVariantImage(variant: any): string {
    if (!variant) return this.apiProduct?.thumbnail_url || '/mobile.jpg';
    const images = variant.im_ProductImages || [];
    const primary = images.find((img: any) => img.is_primary === 'T') || images[0];
    return primary?.image_url || this.apiProduct?.thumbnail_url || '/mobile.jpg';
  }

  private initializeVariants(apiProduct: any): void {
    const variants = apiProduct?.im_ProductVariants || [];
    this.attributeLabels.clear();
    this.valueLabels.clear();
    this.colorCodes.clear();
    this.selectedAttributes.clear();
    this.variantGroups = [];

    if (!variants.length) return;

    const attributeMap = new Map<string, Set<string>>();
    const attributeMeta = new Map<
      string,
      { names: Set<string>; colorScore: number; sizeScore: number }
    >();

    variants.forEach((v: any) => {
      (v.im_VariantAttributes || []).forEach((attr: any) => {
        if (!attr.attribute_id || !attr.value_id) return;

        if (!attributeMap.has(attr.attribute_id)) {
          attributeMap.set(attr.attribute_id, new Set());
        }
        attributeMap.get(attr.attribute_id)!.add(attr.value_id);

        if (!attributeMeta.has(attr.attribute_id)) {
          attributeMeta.set(attr.attribute_id, {
            names: new Set<string>(),
            colorScore: 0,
            sizeScore: 0,
          });
        }
        const meta = attributeMeta.get(attr.attribute_id)!;
        const attrName = String(
          attr?.attribute_name || attr?.attributeName || attr?.name || ''
        ).trim();
        if (attrName) meta.names.add(attrName);

        if (this.isColorLikeAttribute(attr)) meta.colorScore += 2;
        if (this.isSizeLikeAttribute(attr)) meta.sizeScore += 2;
        if (/color/i.test(attrName)) meta.colorScore += 4;
        if (/size/i.test(attrName)) meta.sizeScore += 4;

        if (!this.valueLabels.has(attr.value_id)) {
          const readable = this.getReadableVariantValue(attr);
          this.valueLabels.set(
            attr.value_id,
            readable ||
              (attr.value_id?.length > 12
                ? attr.value_id.slice(0, 8) + '…'
                : attr.value_id || '')
          );
        }

        if (!this.colorCodes.has(attr.value_id)) {
          const rawValue = String(attr?.value || '').trim();
          const rawColorName = String(attr?.color_name || '').trim();
          if (this.isHexColor(rawValue)) this.colorCodes.set(attr.value_id, rawValue);
          else if (this.isHexColor(rawColorName)) {
            this.colorCodes.set(attr.value_id, rawColorName);
          }
        }
      });
    });

    const attributeIds = Array.from(attributeMap.keys());
    if (attributeIds.length === 0) return;

    const sortedByColor = [...attributeIds].sort(
      (a, b) =>
        (attributeMeta.get(b)?.colorScore || 0) - (attributeMeta.get(a)?.colorScore || 0)
    );
    const sortedBySize = [...attributeIds].sort(
      (a, b) =>
        (attributeMeta.get(b)?.sizeScore || 0) - (attributeMeta.get(a)?.sizeScore || 0)
    );

    const colorAttrId = sortedByColor[0] || '';
    const sizeAttrId =
      sortedBySize.find((id) => id !== colorAttrId) ||
      attributeIds.find((id) => id !== colorAttrId) ||
      '';

    attributeIds.forEach((attrId, idx) => {
      const fallbackLabel =
        idx === 0 ? 'Color' : idx === 1 ? 'Size' : `Option ${idx + 1}`;
      const metaLabel = Array.from(attributeMeta.get(attrId)?.names || [])[0];
      this.attributeLabels.set(attrId, metaLabel || fallbackLabel);
    });

    // Do NOT auto-select — user must choose (Temu-style).
    this.variantGroups = attributeIds.map((attrId, idx) => ({
      attributeId: attrId,
      values: Array.from(attributeMap.get(attrId) || []),
      type:
        attrId === colorAttrId
          ? 'color'
          : attrId === sizeAttrId
            ? 'size'
            : 'option',
      label: this.attributeLabels.get(attrId) || `Option ${idx + 1}`,
    }));
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
    if (value && !valueLooksLikeHex && !valueLooksLikeId) return value;
    if (colorName && !colorNameLooksLikeHex) return colorName;
    if (value) return value;
    if (colorName) return colorName;
    return '';
  }

  private isColorLikeAttribute(attr: any): boolean {
    const value = String(attr?.value || '').trim().toLowerCase();
    const colorName = String(attr?.color_name || '').trim().toLowerCase();
    const attrName = String(
      attr?.attribute_name || attr?.attributeName || ''
    )
      .trim()
      .toLowerCase();
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
    const attrName = String(
      attr?.attribute_name || attr?.attributeName || ''
    )
      .trim()
      .toLowerCase();
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
}
