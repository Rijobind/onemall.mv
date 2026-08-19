import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Footer } from '../../../../shared/components/footer/footer';
import { Header } from '../../../../shared/components/header/header';
import { Signin } from '../../../products/models/signin/signin';
import { Signup } from '../../../products/models/signup/signup';
import { AuthService } from '../../../../core/services/auth.service/auth.service';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { CartItem, CartService } from '../../../../core/services/cart.service/cart.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { RegionService } from '../../../../core/services/region.service/region.service';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { NotificationService } from '../../../../core/services/notifications.service/notifications.service';
import {
  extractApiData,
  extractApiMessage,
  isApiSuccess,
} from '../../../../core/utils/api-response.util';
import { isProductGuid } from '../../../../core/utils/product-url.util';
import { resolveCurrencySymbol } from '../../../../core/utils/marketplace-shop.util';

/** Marketplace quotation currencies — ISO codes only (never symbols). */
const ISO_CURRENCY_CODES = new Set(['USD', 'INR', 'MVR']);
const CURRENCY_SYMBOL_TO_ISO: Record<string, string> = {
  $: 'USD',
  USD: 'USD',
  RF: 'MVR',
  MVR: 'MVR',
  '₹': 'INR',
  INR: 'INR',
  RS: 'INR',
};

interface QuoteItem {
  id: string;
  slug?: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  store_id?: string;
  store_name?: string;
  shop_location?: string;
  store_currency_code?: string;
  store_currency_symbol?: string;
  selectedAttributes?: Record<string, string>;
}

interface StoreGroup {
  store_id: string;
  store_name: string;
  shop_location: string;
  items: QuoteItem[];
  subtotal: number;
}

interface SubmittedQuote {
  quotation_id: string;
  quotation_no: string;
  status: string;
  total: number;
  currency_code: string;
  currency_symbol: string;
  item_count: number;
  store_count: number;
}

@Component({
  selector: 'app-quotation',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer, Signin, Signup],
  templateUrl: './quotation.html',
  styleUrl: './quotation.css',
})
export class Quotation implements OnInit {
  quoteItems: QuoteItem[] = [];
  storeGroups: StoreGroup[] = [];
  note = '';
  createdAt = new Date();

  isSubmitting = false;
  submitError = '';
  submitted: SubmittedQuote | null = null;

  isSigninModalOpen = false;
  isSignupModalOpen = false;

  constructor(
    private cartService: CartService,
    private auth: AuthService,
    private currency: CurrencyService,
    private region: RegionService,
    private shopService: MarketplaceShopService,
    private api: BackendapiServices,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const rawItems = this.cartService.getItems();
    this.applyItems(rawItems);
    this.shopService.enrichWithShopNames(rawItems as any[]).subscribe({
      next: (enriched) => this.applyItems(enriched as CartItem[]),
      error: () => {
        /* raw items already shown */
      },
    });
  }

  private applyItems(items: CartItem[]): void {
    this.quoteItems = items.map((item) => {
      const storeCurrencyCode = this.toIsoCurrencyCode(
        item.store_currency_code,
        this.currency.currencyCode
      );
      return {
        id: String(item.id || '').trim(),
        slug: item.slug || undefined,
        name: item.name || 'Untitled Product',
        image: item.image || '/mobile.jpg',
        price: Number(item.price) || 0,
        quantity: Math.max(1, Number(item.quantity) || 1),
        variantId: this.resolveApiVariantId(item.variantId),
        variantLabel: item.variantLabel || '',
        store_id: String(item.store_id || '').trim(),
        store_name: item.store_name || 'Shop',
        shop_location: item.shop_location || '',
        store_currency_code: storeCurrencyCode,
        store_currency_symbol:
          item.store_currency_symbol ||
          resolveCurrencySymbol(storeCurrencyCode) ||
          this.currencySymbol,
        selectedAttributes: item.selectedAttributes,
      };
    });
    this.storeGroups = this.groupByStore(this.quoteItems);
    this.cdr.markForCheck();
  }

  private groupByStore(items: QuoteItem[]): StoreGroup[] {
    const map = new Map<string, StoreGroup>();
    for (const item of items) {
      const key = item.store_id || item.store_name || 'unknown';
      let group = map.get(key);
      if (!group) {
        group = {
          store_id: item.store_id || '',
          store_name: item.store_name || 'Shop',
          shop_location: item.shop_location || '',
          items: [],
          subtotal: 0,
        };
        map.set(key, group);
      }
      group.items.push(item);
      group.subtotal += item.price * item.quantity;
      if (!group.shop_location && item.shop_location) {
        group.shop_location = item.shop_location;
      }
    }
    return Array.from(map.values());
  }

  /** Normalize to ISO (USD / INR / MVR). Never return a display symbol. */
  private toIsoCurrencyCode(
    value: unknown,
    fallback = 'USD'
  ): string {
    const raw = String(value || '').trim();
    if (!raw) {
      const fb = String(fallback || 'USD').trim().toUpperCase();
      return ISO_CURRENCY_CODES.has(fb) ? fb : 'USD';
    }
    const upper = raw.toUpperCase();
    if (ISO_CURRENCY_CODES.has(upper)) return upper;
    const fromSymbol = CURRENCY_SYMBOL_TO_ISO[raw] || CURRENCY_SYMBOL_TO_ISO[upper];
    if (fromSymbol) return fromSymbol;
    const fb = String(fallback || 'USD').trim().toUpperCase();
    return ISO_CURRENCY_CODES.has(fb) ? fb : 'USD';
  }

  /**
   * Backend expects a real variant Guid, or "default" when none exists.
   * Cart may store attribute fingerprints — those are not valid Guids.
   */
  private resolveApiVariantId(variantId: unknown): string {
    const raw = String(variantId || '').trim();
    if (!raw || raw.toLowerCase() === 'default') return 'default';
    return isProductGuid(raw) ? raw : 'default';
  }

  /** Items missing a real store Guid — block submit for these. */
  get itemsMissingStoreId(): QuoteItem[] {
    return this.quoteItems.filter((item) => !isProductGuid(item.store_id || ''));
  }

  get itemsMissingProductId(): QuoteItem[] {
    return this.quoteItems.filter((item) => !isProductGuid(item.id || ''));
  }

  private validatePayloadBeforeSubmit(): string {
    if (!this.quoteItems.length) {
      return 'No items to submit.';
    }
    const missingStore = this.itemsMissingStoreId;
    if (missingStore.length) {
      const names = missingStore
        .slice(0, 3)
        .map((i) => i.name)
        .join(', ');
      const more =
        missingStore.length > 3 ? ` and ${missingStore.length - 3} more` : '';
      return `Each item needs a valid store before submitting. Missing store for: ${names}${more}. Remove those items and add them again from the product page.`;
    }
    const missingProduct = this.itemsMissingProductId;
    if (missingProduct.length) {
      return 'One or more items have an invalid product id. Remove them and add again from the product page.';
    }
    return '';
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  get customerName(): string {
    return this.auth.customer?.full_name?.trim() || 'Guest';
  }

  get customerInitial(): string {
    return (this.customerName.charAt(0) || 'G').toUpperCase();
  }

  get customerEmail(): string {
    return this.auth.customer?.email?.trim() || '';
  }

  get customerPhone(): string {
    const c = this.auth.customer;
    if (!c?.phone_number) return '';
    const code = c.country_code ? `${c.country_code} ` : '';
    return `${code}${c.phone_number}`.trim();
  }

  get deliveryRegion(): string {
    return this.region.displayLabel || '';
  }

  /** Customer-facing currency for the quotation (ISO), not store currency. */
  get currencyCode(): string {
    return this.toIsoCurrencyCode(this.currency.currencyCode, 'USD');
  }

  get currencySymbol(): string {
    return (
      this.currency.selectedOption?.symbol ||
      resolveCurrencySymbol(this.currencyCode) ||
      this.currencyCode
    );
  }

  get formattedDate(): string {
    return this.createdAt.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  get itemCount(): number {
    return this.quoteItems.reduce((sum, i) => sum + i.quantity, 0);
  }

  get subtotal(): number {
    return this.quoteItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  get total(): number {
    return this.subtotal;
  }

  get canSubmit(): boolean {
    return (
      !this.isSubmitting &&
      !this.submitted &&
      this.quoteItems.length > 0 &&
      this.auth.isLoggedIn &&
      this.itemsMissingStoreId.length === 0 &&
      this.itemsMissingProductId.length === 0
    );
  }

  /** Guests may click to open sign-in; logged-in users need a valid payload. */
  get canClickSubmit(): boolean {
    if (this.isSubmitting || this.submitted || !this.quoteItems.length) return false;
    if (!this.auth.isLoggedIn) return true;
    return (
      this.itemsMissingStoreId.length === 0 &&
      this.itemsMissingProductId.length === 0
    );
  }

  formatMoney(amount: number): string {
    const n = Number(amount) || 0;
    return `${this.currencySymbol}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  lineAmount(item: QuoteItem): number {
    return item.price * item.quantity;
  }

  submitQuotation(): void {
    this.submitError = '';

    if (!this.auth.isLoggedIn) {
      this.openSigninModal();
      return;
    }
    if (!this.quoteItems.length || this.isSubmitting || this.submitted) return;

    const validationError = this.validatePayloadBeforeSubmit();
    if (validationError) {
      this.submitError = validationError;
      return;
    }

    const region = this.region.getEffectiveSelection();
    const currencyCode = this.currencyCode;
    const currencySymbol = this.currencySymbol;

    // Multi-store cart → one request; backend splits by store.
    // Never send customer_id — JWT identifies the marketplace customer.
    const payload = {
      note: this.note?.trim() || null,
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
      region_name: region.regionName || null,
      city: region.city || null,
      country_region_id: region.countryRegionId || null,
      items: this.quoteItems.map((item) => {
        const storeCurrencyCode = this.toIsoCurrencyCode(
          item.store_currency_code,
          currencyCode
        );
        return {
          product_id: item.id,
          product_name: item.name,
          slug: item.slug || null,
          variant_id: this.resolveApiVariantId(item.variantId),
          variant_label: item.variantLabel || null,
          image_url: item.image || null,
          unit_price: item.price,
          quantity: item.quantity,
          store_id: item.store_id,
          store_name: item.store_name || null,
          shop_location: item.shop_location || null,
          store_currency_code: storeCurrencyCode,
          store_currency_symbol:
            item.store_currency_symbol ||
            resolveCurrencySymbol(storeCurrencyCode) ||
            currencySymbol,
          selected_attributes: item.selectedAttributes || null,
        };
      }),
    };

    console.groupCollapsed('[quotation] POST /Market_place/quotations — request');
    console.log('currency_code (must be ISO):', payload.currency_code);
    console.log('items:', payload.items.length, payload.items);
    console.log('payload:', JSON.parse(JSON.stringify(payload)));
    console.groupEnd();

    this.isSubmitting = true;
    this.api.createQuotation(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        console.groupCollapsed('[quotation] response (HTTP 200)');
        console.log('body:', res);
        console.log('api status field:', res?.status ?? res?.Status);
        console.log('api message field:', extractApiMessage(res));
        console.groupEnd();

        if (!isApiSuccess(res) && res?.success !== true && res?.Success !== true) {
          const apiStatus = Number(res?.status ?? res?.Status ?? 0);
          console.error(
            apiStatus >= 500
              ? '[quotation] BACKEND ERROR — request was valid, server threw. Check the API console log.'
              : '[quotation] REQUEST REJECTED — backend validation failed on the payload above.',
            { apiStatus, message: extractApiMessage(res) }
          );
          this.submitError =
            this.readApiErrorMessage(res) ||
            'Could not submit quotation. Please try again.';
          return;
        }

        const data = extractApiData(res) ?? res?.data ?? {};
        this.submitted = {
          quotation_id: String(data?.quotation_id ?? data?.quotationId ?? ''),
          quotation_no: String(data?.quotation_no ?? data?.quotationNo ?? ''),
          status: String(data?.status ?? 'Submitted'),
          total: Number(data?.total ?? this.total) || this.total,
          currency_code: this.toIsoCurrencyCode(
            data?.currency_code ?? data?.currencyCode,
            currencyCode
          ),
          currency_symbol: String(
            data?.currency_symbol ?? data?.currencySymbol ?? currencySymbol
          ),
          item_count: Number(data?.item_count ?? data?.itemCount ?? this.itemCount),
          store_count: Number(
            data?.store_count ?? data?.storeCount ?? this.storeGroups.length
          ),
        };

        // Cart clear is a frontend decision after successful submit.
        this.cartService.clearCart();
        this.quoteItems = [];
        this.storeGroups = [];
        this.notificationService.refreshUnreadCount();
      },
      error: (err) => {
        this.isSubmitting = false;
        const httpStatus = Number(err?.status ?? 0);
        console.group('[quotation] HTTP error');
        console.error('status:', httpStatus, err?.statusText);
        console.error('url:', err?.url);
        console.error('body:', err?.error);
        console.error(
          httpStatus === 0
            ? 'Request never reached the API (server down, CORS, or SSL cert not trusted).'
            : httpStatus === 401
              ? 'Token rejected — sign in again.'
              : 'Server responded with an error. Check the API console log.'
        );
        console.groupEnd();

        this.submitError =
          this.readApiErrorMessage(err?.error) ||
          (typeof err?.error?.message === 'string' ? err.error.message : '') ||
          err?.message ||
          'Could not submit quotation. Please try again.';
      },
    });
  }

  /** Prefer backend `message` (e.g. Invalid store_id) for the user. */
  private readApiErrorMessage(body: unknown): string {
    const msg = extractApiMessage(body);
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    if (msg != null && typeof msg !== 'string') {
      try {
        return JSON.stringify(msg);
      } catch {
        return String(msg);
      }
    }
    return '';
  }

  openSigninModal(): void {
    this.isSignupModalOpen = false;
    this.isSigninModalOpen = true;
  }

  closeSigninModal(): void {
    this.isSigninModalOpen = false;
  }

  openSignupModal(): void {
    this.isSigninModalOpen = false;
    this.isSignupModalOpen = true;
  }

  closeSignupModal(): void {
    this.isSignupModalOpen = false;
  }

  onSigninToSignup(): void {
    this.closeSigninModal();
    this.openSignupModal();
  }

  onSignupToSignin(): void {
    this.closeSignupModal();
    this.openSigninModal();
  }
}
