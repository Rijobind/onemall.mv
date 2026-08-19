import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../auth.service/auth.service';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { extractApiData, extractApiList } from '../../utils/api-response.util';

export interface CartItem {
  /** Backend row id (present when synced / loaded from API). */
  cartItemId?: string;
  /** Product id (used for product navigation). */
  id: string;
  /** SEO slug for /product/{slug} links. */
  slug?: string;
  /** Unique cart row key — product + variant. */
  cartLineId: string;
  variantId: string;
  variantLabel?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  inStock?: boolean;
  store_id?: string;
  store_name?: string;
  shop_location?: string;
  store_currency_code?: string;
  store_currency_symbol?: string;
  selectedAttributes?: Record<string, string>;
}

export type CartQuantityMode = 'add' | 'set';

const STORAGE_KEY = 'cart_items';
/** Set while guest mutates cart; cleared after successful login sync / server load. */
const NEEDS_SYNC_KEY = 'cart_needs_sync';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private syncInFlight$: Observable<CartItem[]> | null = null;
  private loadInFlight$: Observable<CartItem[]> | null = null;

  constructor(
    private auth: AuthService,
    private api: BackendapiServices
  ) {
    if (typeof window !== 'undefined') {
      // Fired only after OTP verify (fresh login), not on token refresh.
      window.addEventListener('auth-login', () => {
        this.handleLoginCart().subscribe();
      });
    }
  }

  getItems(): CartItem[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((row) => this.normalizeLocalItem(row)) : [];
    } catch {
      return [];
    }
  }

  /** Stable line key for a product + variant combination. */
  buildCartLineId(productId: string, variantId: string): string {
    return `${String(productId || '')}__${String(variantId || 'default')}`;
  }

  /**
   * Prefer attribute fingerprint when options are selected so the same choices
   * always map to the same cart line across pages (even if API variant ids differ).
   */
  resolveVariantId(
    variant: any,
    selectedAttributes?: Record<string, string> | Map<string, string> | null
  ): string {
    const attrs = this.normalizeAttributes(selectedAttributes);
    if (Object.keys(attrs).length > 0) {
      return Object.entries(attrs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([attrId, valueId]) => `${attrId}:${valueId}`)
        .join('|');
    }

    const explicit = String(
      variant?.id ??
        variant?.product_variant_id ??
        variant?.variant_id ??
        variant?.sku ??
        ''
    ).trim();
    return explicit || 'default';
  }

  findItem(productId: string, variantId: string): CartItem | undefined {
    const pid = String(productId || '');
    const vid = String(variantId || 'default');
    const cartLineId = this.buildCartLineId(pid, vid);

    return this.getItems().find((row) => {
      const rowLineId = String(row?.cartLineId || '');
      if (rowLineId && rowLineId === cartLineId) return true;

      const rowProductId = String(row?.id || '');
      const rowVariantId = String(row?.variantId || 'default');
      return rowProductId === pid && rowVariantId === vid;
    });
  }

  findItemByAttributes(
    productId: string,
    selectedAttributes?: Record<string, string> | Map<string, string> | null,
    variant?: any
  ): CartItem | undefined {
    const variantId = this.resolveVariantId(variant, selectedAttributes);
    return this.findItem(productId, variantId);
  }

  /**
   * Adds a new cart line, or updates an existing one keyed by product + variant.
   * Guest → localStorage only. Logged-in → optimistic local + API upsert.
   */
  addItem(
    item: Omit<CartItem, 'cartLineId'> & { cartLineId?: string },
    quantity = 1,
    options?: { quantityMode?: CartQuantityMode }
  ): CartItem {
    const qty = Math.max(1, Number(quantity) || 1);
    const variantId = String(item.variantId || 'default');
    const productId = String(item.id || '');
    const cartLineId =
      item.cartLineId || this.buildCartLineId(productId, variantId);
    const quantityMode: CartQuantityMode = options?.quantityMode || 'add';

    const existingItems = this.getItems();
    const existingIndex = existingItems.findIndex(
      (row) =>
        String(row?.cartLineId || '') === cartLineId ||
        (String(row?.id || '') === productId &&
          String(row?.variantId || 'default') === variantId)
    );

    const nextItem: CartItem = {
      cartItemId: item.cartItemId || existingItems[existingIndex]?.cartItemId,
      id: productId,
      slug: item.slug || existingItems[existingIndex]?.slug,
      cartLineId,
      variantId,
      variantLabel: item.variantLabel || '',
      name: item.name || 'Untitled Product',
      price: Number(item.price) || 0,
      originalPrice: Number(item.originalPrice) || 0,
      image: item.image || '/mobile.jpg',
      quantity: qty,
      inStock: item.inStock !== false,
      store_id: item.store_id ? String(item.store_id) : undefined,
      store_name: item.store_name || undefined,
      shop_location: item.shop_location || undefined,
      store_currency_code: item.store_currency_code
        ? String(item.store_currency_code).trim().toUpperCase()
        : undefined,
      store_currency_symbol: item.store_currency_symbol || undefined,
      selectedAttributes: item.selectedAttributes,
    };

    if (existingIndex >= 0) {
      const prev = existingItems[existingIndex];
      existingItems[existingIndex] = {
        ...prev,
        ...nextItem,
        cartItemId: nextItem.cartItemId || prev.cartItemId,
        quantity:
          quantityMode === 'set' ? qty : (Number(prev.quantity) || 0) + qty,
      };
    } else {
      existingItems.push(nextItem);
    }

    const saved =
      existingIndex >= 0 ? existingItems[existingIndex] : nextItem;
    this.persist(existingItems, { guestDirty: !this.auth.isLoggedIn });

    if (this.auth.isLoggedIn) {
      this.api.upsertCustomerCartItem(this.toUpsertPayload(saved, quantityMode, qty)).subscribe({
        next: (res) => {
          const mapped = this.mapApiItem(this.extractSingleItem(res) ?? saved);
          this.replaceLine(mapped);
        },
        error: () => {
          /* keep optimistic local row */
        },
      });
    }

    return saved;
  }

  /** Set absolute quantity for a line (qty <= 0 removes). */
  setQuantity(cartLineIdOrId: string, quantity: number): CartItem[] {
    const key = String(cartLineIdOrId || '');
    if (!key) return this.getItems();

    if (quantity <= 0) {
      return this.removeItem(key);
    }

    const items = this.getItems();
    const index = items.findIndex(
      (row) =>
        String(row.cartLineId || '') === key ||
        String(row.cartItemId || '') === key ||
        String(row.id || '') === key
    );
    if (index < 0) return items;

    items[index] = {
      ...items[index],
      quantity: Math.max(1, Number(quantity) || 1),
    };
    this.persist(items, { guestDirty: !this.auth.isLoggedIn });

    if (this.auth.isLoggedIn) {
      const row = items[index];
      const payload = { quantity: row.quantity };
      const req$ = row.cartItemId
        ? this.api.updateCustomerCartItem(row.cartItemId, payload)
        : this.api.updateCustomerCartItemByLine(row.cartLineId, payload);

      req$.subscribe({
        next: (res) => {
          const mapped = this.mapApiItem(this.extractSingleItem(res) ?? row);
          this.replaceLine(mapped);
        },
        error: () => {},
      });
    }

    return items;
  }

  /** Remove by cartLineId, cartItemId, or product id. */
  removeItem(cartLineIdOrId: string): CartItem[] {
    const key = String(cartLineIdOrId || '');
    const items = this.getItems();
    const target = items.find(
      (row) =>
        String(row.cartLineId || '') === key ||
        String(row.cartItemId || '') === key ||
        String(row.id || '') === key
    );
    const next = items.filter(
      (row) =>
        String(row.cartLineId || '') !== key &&
        String(row.cartItemId || '') !== key &&
        String(row.id || '') !== key
    );
    this.persist(next, { guestDirty: !this.auth.isLoggedIn });

    if (this.auth.isLoggedIn && target) {
      const req$ = target.cartItemId
        ? this.api.deleteCustomerCartItem(target.cartItemId)
        : this.api.deleteCustomerCartItemByLine(target.cartLineId);
      req$.subscribe({ error: () => {} });
    }

    return next;
  }

  /** Replace entire local cart (used by cart page bulk persist — prefer setQuantity/remove). */
  replaceAll(items: CartItem[]): CartItem[] {
    const normalized = (items || []).map((row) => this.normalizeLocalItem(row));
    this.persist(normalized, { guestDirty: !this.auth.isLoggedIn });
    return normalized;
  }

  /** Clear local cart mirror; if logged in also clear backend cart. */
  clearCart(): void {
    this.persist([], { guestDirty: false });
    this.clearNeedsSync();
    if (this.auth.isLoggedIn) {
      this.api.clearCustomerCart().subscribe({ error: () => {} });
    }
  }

  /** After session restore / refresh — load server cart (no merge). */
  loadFromServer(): Observable<CartItem[]> {
    if (!this.auth.isLoggedIn) {
      return of(this.getItems());
    }
    if (this.loadInFlight$) {
      return this.loadInFlight$;
    }

    this.loadInFlight$ = this.api.getCustomerCart().pipe(
      map((res) => this.mapApiList(res)),
      tap((items) => {
        this.persist(items, { guestDirty: false });
        this.clearNeedsSync();
      }),
      catchError(() => of(this.getItems())),
      tap(() => {
        this.loadInFlight$ = null;
      })
    );

    return this.loadInFlight$;
  }

  /**
   * Fresh login: merge guest localStorage into backend once, then mirror server cart.
   * Skips sync when guest never changed cart (avoids double-qty on re-login).
   */
  handleLoginCart(): Observable<CartItem[]> {
    if (!this.auth.isLoggedIn) {
      return of(this.getItems());
    }

    if (this.needsSync() && this.getItems().length > 0) {
      return this.syncGuestCart();
    }
    return this.loadFromServer();
  }

  /** POST /cart/sync with current local items, then replace local with response. */
  syncGuestCart(): Observable<CartItem[]> {
    if (!this.auth.isLoggedIn) {
      return of(this.getItems());
    }
    if (this.syncInFlight$) {
      return this.syncInFlight$;
    }

    const guestItems = this.getItems();
    this.syncInFlight$ = this.api.syncCustomerCart({ items: guestItems }).pipe(
      map((res) => this.mapApiList(res)),
      tap((items) => {
        this.persist(items, { guestDirty: false });
        this.clearNeedsSync();
      }),
      catchError(() => this.loadFromServer()),
      tap(() => {
        this.syncInFlight$ = null;
      })
    );

    return this.syncInFlight$;
  }

  private toUpsertPayload(
    item: CartItem,
    quantityMode: CartQuantityMode,
    quantity: number
  ): Record<string, unknown> {
    return {
      product_id: item.id,
      variant_id: item.variantId || 'default',
      cart_line_id: item.cartLineId,
      variant_label: item.variantLabel || null,
      product_name: item.name,
      unit_price: item.price,
      original_price: item.originalPrice ?? null,
      image_url: item.image || null,
      quantity: Math.max(1, Number(quantity) || 1),
      quantity_mode: quantityMode,
      in_stock: item.inStock !== false,
      store_id: item.store_id || null,
      store_name: item.store_name || null,
      shop_location: item.shop_location || null,
      store_currency_code: item.store_currency_code || null,
      store_currency_symbol: item.store_currency_symbol || null,
      selected_attributes: item.selectedAttributes || null,
    };
  }

  private replaceLine(item: CartItem): void {
    const items = this.getItems();
    const index = items.findIndex(
      (row) =>
        String(row.cartLineId) === String(item.cartLineId) ||
        (item.cartItemId && String(row.cartItemId) === String(item.cartItemId))
    );
    if (index >= 0) {
      items[index] = { ...items[index], ...item };
    } else {
      items.push(item);
    }
    this.persist(items, { guestDirty: false });
  }

  private mapApiList(res: any): CartItem[] {
    const rows = this.extractList(res);
    return rows.map((row) => this.mapApiItem(row)).filter((row) => !!row.id);
  }

  private extractList(res: any): any[] {
    const data = extractApiData(res) ?? res?.data ?? res?.Data ?? res;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.Items)) return data.Items;
    if (Array.isArray(data?.cart_items)) return data.cart_items;
    if (Array.isArray(data?.cartItems)) return data.cartItems;
    return extractApiList(res);
  }

  private extractSingleItem(res: any): any | null {
    const data = extractApiData(res) ?? res?.data ?? res?.Data ?? res;
    if (!data) return null;
    if (Array.isArray(data)) return data[0] ?? null;
    if (data?.item) return data.item;
    if (data?.Item) return data.Item;
    if (typeof data === 'object') return data;
    return null;
  }

  private mapApiItem(row: any): CartItem {
    const productId = String(row?.id ?? row?.product_id ?? row?.productId ?? '');
    const variantId = String(
      row?.variantId ?? row?.variant_id ?? 'default'
    );
    const cartLineId = String(
      row?.cartLineId ??
        row?.cart_line_id ??
        this.buildCartLineId(productId, variantId)
    );

    let selectedAttributes = row?.selectedAttributes ?? row?.selected_attributes;
    if (typeof selectedAttributes === 'string') {
      try {
        selectedAttributes = JSON.parse(selectedAttributes);
      } catch {
        selectedAttributes = undefined;
      }
    }

    return {
      cartItemId: String(
        row?.cartItemId ?? row?.cart_item_id ?? row?.cartItemID ?? ''
      ) || undefined,
      id: productId,
      slug: String(row?.slug || '').trim() || undefined,
      cartLineId,
      variantId,
      variantLabel: row?.variantLabel ?? row?.variant_label ?? '',
      name: String(row?.name ?? row?.product_name ?? row?.productName ?? 'Untitled Product'),
      price: Number(row?.price ?? row?.unit_price ?? row?.unitPrice) || 0,
      originalPrice:
        Number(row?.originalPrice ?? row?.original_price ?? 0) || 0,
      image: String(row?.image ?? row?.image_url ?? row?.imageUrl ?? '/mobile.jpg'),
      quantity: Math.max(1, Number(row?.quantity) || 1),
      inStock: row?.inStock ?? row?.in_stock !== false,
      store_id: (row?.store_id ?? row?.storeId)
        ? String(row?.store_id ?? row?.storeId)
        : undefined,
      store_name: row?.store_name ?? row?.storeName ?? undefined,
      shop_location: row?.shop_location ?? row?.shopLocation ?? undefined,
      store_currency_code: (row?.store_currency_code ?? row?.storeCurrencyCode)
        ? String(row?.store_currency_code ?? row?.storeCurrencyCode)
            .trim()
            .toUpperCase()
        : undefined,
      store_currency_symbol:
        row?.store_currency_symbol ?? row?.storeCurrencySymbol ?? undefined,
      selectedAttributes:
        selectedAttributes && typeof selectedAttributes === 'object'
          ? selectedAttributes
          : undefined,
    };
  }

  private normalizeLocalItem(row: any): CartItem {
    return this.mapApiItem(row);
  }

  private normalizeAttributes(
    selectedAttributes?: Record<string, string> | Map<string, string> | null
  ): Record<string, string> {
    if (!selectedAttributes) return {};
    if (selectedAttributes instanceof Map) {
      const out: Record<string, string> = {};
      selectedAttributes.forEach((valueId, attrId) => {
        if (attrId && valueId) out[attrId] = valueId;
      });
      return out;
    }
    return { ...selectedAttributes };
  }

  private persist(
    items: CartItem[],
    options?: { guestDirty?: boolean }
  ): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (options?.guestDirty) {
      this.markNeedsSync();
    }
    window.dispatchEvent(new Event('cart-updated'));
  }

  private needsSync(): boolean {
    return localStorage.getItem(NEEDS_SYNC_KEY) === '1';
  }

  private markNeedsSync(): void {
    localStorage.setItem(NEEDS_SYNC_KEY, '1');
  }

  private clearNeedsSync(): void {
    localStorage.removeItem(NEEDS_SYNC_KEY);
  }
}
