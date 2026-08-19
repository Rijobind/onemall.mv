import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { AuthService } from '../auth.service/auth.service';
import { MarketplaceProductParams } from '../region.service/region.service';
import { extractApiList } from '../../utils/api-response.util';

export interface MarketplaceCurrencyOption {
  currency_code: string;
  currency_name: string;
  country_name: string;
  country_code: string;
  country_id?: string | null;
  flag: string;
  flag_url: string;
  symbol?: string;
  label: string;
}

/** Marketplace only supports these currencies. */
const ALLOWED_CURRENCIES: Record<
  string,
  { country_code: string; country_name: string; currency_name: string; flag: string }
> = {
  MVR: {
    country_code: 'MV',
    country_name: 'Maldives',
    currency_name: 'Maldivian Rufiyaa',
    flag: '🇲🇻',
  },
  INR: {
    country_code: 'IN',
    country_name: 'India',
    currency_name: 'Indian Rupee',
    flag: '🇮🇳',
  },
  USD: {
    country_code: 'US',
    country_name: 'United States',
    currency_name: 'US Dollar',
    flag: '🇺🇸',
  },
};

const ALLOWED_CURRENCY_CODES = Object.keys(ALLOWED_CURRENCIES);

@Injectable({
  providedIn: 'root',
})
export class CurrencyService {
  private readonly currencyStorageKey = 'marketplace_currency_code';
  private readonly countryStorageKey = 'marketplace_country_code';
  private readonly preferenceCurrencyKey = 'marketplace_user_currency_code';

  private readonly currencySubject = new BehaviorSubject<string>(
    this.readStoredCurrency() || 'USD'
  );
  private readonly countrySubject = new BehaviorSubject<string>(
    this.readStoredCountry() || ''
  );

  readonly currency$ = this.currencySubject.asObservable();
  readonly country$ = this.countrySubject.asObservable();

  options: MarketplaceCurrencyOption[] = [];
  private loaded = false;
  private generation = 0;

  constructor(
    private api: BackendapiServices,
    private auth: AuthService
  ) {}

  get currencyCode(): string {
    return this.resolveCurrencyCode();
  }

  get countryCode(): string {
    return this.countrySubject.value;
  }

  /** Bumps on each currency change — pages ignore older in-flight product responses. */
  get fetchGeneration(): number {
    return this.generation;
  }

  get selectedOption(): MarketplaceCurrencyOption | undefined {
    const code = this.currencyCode;
    return this.options.find((o) => o.currency_code === code);
  }

  get displayLabel(): string {
    const opt = this.selectedOption;
    if (opt) return opt.country_name;
    return this.currencyCode;
  }

  get shortLabel(): string {
    return this.currencyCode || 'USD';
  }

  /**
   * Resolve currency for product fetches.
   * In-memory selection (currencySubject) wins so fetches never use a stale preference.
   */
  resolveCurrencyCode(): string {
    const selected = String(this.currencySubject.value || '')
      .trim()
      .toUpperCase();
    if (selected && ALLOWED_CURRENCIES[selected]) return selected;

    const userPref = this.readUserPreferenceCurrency();
    if (userPref && ALLOWED_CURRENCIES[userPref]) return userPref;

    const local = this.readStoredCurrency();
    if (local && ALLOWED_CURRENCIES[local]) return local;

    const fromCountry = this.defaultCurrencyForCountry(this.countrySubject.value);
    if (fromCountry && ALLOWED_CURRENCIES[fromCountry]) return fromCountry;

    return 'USD';
  }

  /**
   * Merge region params with currency / user / country for marketplace product APIs.
   * Pass currencyOverride when refetching after a currency change (avoids stale reads).
   */
  enrichProductParams(
    params?: MarketplaceProductParams,
    currencyOverride?: string | null
  ): MarketplaceProductParams {
    const merged: MarketplaceProductParams = { ...(params || {}) };
    const override = String(currencyOverride || '')
      .trim()
      .toUpperCase();
    const currency =
      (override && ALLOWED_CURRENCIES[override] ? override : '') ||
      this.resolveCurrencyCode();
    if (currency) {
      merged.currency_code = currency;
    }

    const userId = String(this.auth.customer?.customer_id || '').trim();
    if (userId) {
      merged.user_id = userId;
    }

    const country = String(this.countryCode || '').trim().toUpperCase();
    if (country) {
      merged.country_code = country;
    }

    return merged;
  }

  loadOptions(): Observable<MarketplaceCurrencyOption[]> {
    if (this.loaded && this.options.length) {
      return of(this.options);
    }

    return this.api.getMarketplaceCurrencies().pipe(
      map((res: any) => this.normalizeCurrencyOptions(extractApiList(res))),
      catchError(() =>
        this.api.getMarketplaceCountries().pipe(
          map((res: any) => this.normalizeCurrencyOptions(extractApiList(res))),
          catchError(() => of(this.fallbackOptions()))
        )
      ),
      tap((options) => {
        this.options = options.length ? options : this.fallbackOptions();
        this.loaded = true;
        this.syncSelectionWithOptions();
      })
    );
  }

  /**
   * Persist + broadcast the NEW currency before any product refetch.
   * Preference API runs in parallel and must not gate the product fetch.
   */
  setCurrency(currencyCode: string, countryCode?: string | null): Observable<void> {
    const next = String(currencyCode || '').trim().toUpperCase() || 'USD';
    const country = String(countryCode || '').trim().toUpperCase();

    // 1) Capture + persist NEXT code first (both guest + logged-in keys)
    this.writeStoredCurrency(next);
    if (this.auth.isLoggedIn || this.auth.hasSavedSession) {
      this.writeUserPreferenceCurrency(next);
    }
    if (country) {
      this.writeStoredCountry(country);
      this.countrySubject.next(country);
    }

    // 2) Update in-memory selection, then notify listeners with the same next code
    this.generation += 1;
    this.currencySubject.next(next);
    this.api.clearMarketplaceProductsCache();
    this.emitCurrencyUpdated(next);

    // 3) Persist preference for logged-in users in parallel (do not block refetch)
    const customerId = String(this.auth.customer?.customer_id || '').trim();
    if (!customerId || !(this.auth.isLoggedIn || this.auth.hasSavedSession)) {
      return of(void 0);
    }

    const option = this.options.find((o) => o.currency_code === next);
    return this.api
      .saveCustomerCurrencyPreference({
        user_id: customerId,
        currency: next,
        country_id: option?.country_id ?? null,
      })
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0))
      );
  }

  /** True if this generation is still the latest currency selection. */
  isCurrentGeneration(generation: number): boolean {
    return generation === this.generation;
  }

  private syncSelectionWithOptions(): void {
    const current = this.resolveCurrencyCode();
    if (this.currencySubject.value !== current) {
      this.currencySubject.next(current);
    }
  }

  private emitCurrencyUpdated(currencyCode: string): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('currency-updated', {
        detail: {
          currency_code: currencyCode,
          generation: this.generation,
        },
      })
    );
  }

  private readStoredCurrency(): string {
    if (typeof window === 'undefined') return '';
    return String(localStorage.getItem(this.currencyStorageKey) || '')
      .trim()
      .toUpperCase();
  }

  private writeStoredCurrency(code: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.currencyStorageKey, code);
  }

  private readStoredCountry(): string {
    if (typeof window === 'undefined') return '';
    return String(localStorage.getItem(this.countryStorageKey) || '')
      .trim()
      .toUpperCase();
  }

  private writeStoredCountry(code: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.countryStorageKey, code);
  }

  private readUserPreferenceCurrency(): string {
    if (typeof window === 'undefined') return '';
    if (!(this.auth.isLoggedIn || this.auth.hasSavedSession)) return '';
    return String(localStorage.getItem(this.preferenceCurrencyKey) || '')
      .trim()
      .toUpperCase();
  }

  private writeUserPreferenceCurrency(code: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.preferenceCurrencyKey, code);
  }

  private defaultCurrencyForCountry(countryCode: string): string {
    const code = String(countryCode || '').trim().toUpperCase();
    if (!code) return '';
    const match = this.options.find((o) => o.country_code === code);
    return match?.currency_code || '';
  }

  private normalizeCurrencyOptions(rows: any[]): MarketplaceCurrencyOption[] {
    const mapped = rows
      .map((row) => this.normalizeOption(row))
      .filter((o): o is MarketplaceCurrencyOption => !!o)
      .filter((o) => ALLOWED_CURRENCY_CODES.includes(o.currency_code));

    const byCode = new Map<string, MarketplaceCurrencyOption>();
    for (const option of mapped) {
      if (!byCode.has(option.currency_code)) {
        byCode.set(option.currency_code, option);
      }
    }

    // Keep stable order: MVR, INR, USD — fill gaps from canonical list
    return ALLOWED_CURRENCY_CODES.map((code) => {
      const existing = byCode.get(code);
      return existing || this.canonicalOption(code)!;
    });
  }

  private normalizeOption(raw: any): MarketplaceCurrencyOption | null {
    const currency_code = String(
      raw?.currency_code ??
        raw?.currencyCode ??
        raw?.CurrencyCode ??
        raw?.currency ??
        raw?.code ??
        ''
    )
      .trim()
      .toUpperCase();
    if (!currency_code || !ALLOWED_CURRENCIES[currency_code]) return null;

    const canonical = ALLOWED_CURRENCIES[currency_code];
    const country_code = String(
      raw?.country_code ??
        raw?.countryCode ??
        raw?.CountryCode ??
        raw?.iso2 ??
        canonical.country_code
    )
      .trim()
      .toUpperCase() || canonical.country_code;

    const country_name =
      String(
        raw?.country_name ??
          raw?.countryName ??
          raw?.CountryName ??
          raw?.name ??
          ''
      ).trim() || canonical.country_name;

    const flag =
      String(raw?.flag ?? raw?.Flag ?? raw?.emoji ?? '').trim() || canonical.flag;
    const currency_name =
      String(raw?.currency_name ?? raw?.currencyName ?? '').trim() ||
      canonical.currency_name;
    const country_id =
      raw?.country_id ?? raw?.countryId ?? raw?.CountryId ?? null;
    const symbol = String(raw?.symbol ?? raw?.display_symbol ?? '').trim() || undefined;

    return {
      currency_code,
      currency_name,
      country_name,
      country_code,
      country_id: country_id != null ? String(country_id) : null,
      flag,
      flag_url: this.flagImageUrl(country_code),
      symbol,
      label: `${country_name} - ${currency_code}`,
    };
  }

  private flagImageUrl(countryCode: string): string {
    const code = String(countryCode || '').trim().toLowerCase();
    return `https://flagcdn.com/w80/${code}.png`;
  }

  private canonicalOption(currencyCode: string): MarketplaceCurrencyOption | null {
    const meta = ALLOWED_CURRENCIES[currencyCode];
    if (!meta) return null;
    return {
      currency_code: currencyCode,
      currency_name: meta.currency_name,
      country_name: meta.country_name,
      country_code: meta.country_code,
      flag: meta.flag,
      flag_url: this.flagImageUrl(meta.country_code),
      label: `${meta.country_name} - ${currencyCode}`,
    };
  }

  private fallbackOptions(): MarketplaceCurrencyOption[] {
    return ALLOWED_CURRENCY_CODES.map((code) => this.canonicalOption(code)!);
  }
}
