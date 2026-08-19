import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { extractApiData, extractApiMessage } from '../../utils/api-response.util';

export interface AuthCustomer {
  customer_id: string;
  full_name: string;
  email?: string;
  country_code?: string;
  phone_number?: string;
  profile_image_url?: string | null;
}

export interface ProfileImagePresign {
  upload_url: string;
  public_url: string;
  object_key: string;
  headers?: Record<string, string>;
}

export interface RegisterCustomerPayload {
  full_name: string;
  email: string;
  country_code: string;
  phone_number: string;
}

export interface PhoneOtpPayload {
  country_code: string;
  phone_number: string;
}

export interface VerifyOtpPayload extends PhoneOtpPayload {
  otp: string;
}

export interface RequestOtpResult {
  message: string;
  otp_dev?: string;
}

export interface CountryDialCode {
  name: string;
  dial_code: string;
  flag: string;
}

const ACCESS_TOKEN_KEY = 'mp_access_token';
const REFRESH_TOKEN_KEY = 'mp_refresh_token';
const CUSTOMER_KEY = 'mp_customer';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  readonly countries: CountryDialCode[] = [
    { name: 'Maldives', dial_code: '+960', flag: '🇲🇻' },
    { name: 'India', dial_code: '+91', flag: '🇮🇳' },
    { name: 'United Arab Emirates', dial_code: '+971', flag: '🇦🇪' },
    { name: 'Sri Lanka', dial_code: '+94', flag: '🇱🇰' },
    { name: 'United Kingdom', dial_code: '+44', flag: '🇬🇧' },
    { name: 'United States', dial_code: '+1', flag: '🇺🇸' },
  ];

  private readonly customerSubject = new BehaviorSubject<AuthCustomer | null>(this.readCustomer());
  readonly customer$ = this.customerSubject.asObservable();

  /** True while restoreSession() is in progress (app boot). */
  private readonly restoringSubject = new BehaviorSubject<boolean>(false);
  readonly restoring$ = this.restoringSubject.asObservable();

  /** Shared in-flight refresh so concurrent 401s only hit the API once. */
  private refreshInFlight$: Observable<boolean> | null = null;

  constructor(private api: BackendapiServices) {}

  /** Has a usable access token right now. */
  get isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  /** Has any saved session (access or refresh) — used before restore finishes. */
  get hasSavedSession(): boolean {
    return !!this.getAccessToken() || !!this.getRefreshToken();
  }

  get customer(): AuthCustomer | null {
    return this.customerSubject.value;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Call once on app startup.
   * If a refresh_token exists, exchange it for fresh tokens.
   * Does NOT open OTP UI and does NOT call request_otp.
   */
  restoreSession(): Observable<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return of(false);
    }

    this.restoringSubject.next(true);
    return this.refreshSession().pipe(
      finalize(() => this.restoringSubject.next(false))
    );
  }

  /**
   * Exchange refresh_token for new access + refresh tokens.
   * Returns true on success; clears session and returns false on 401 / failure.
   */
  refreshSession(): Observable<boolean> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return of(false);
    }

    this.refreshInFlight$ = this.api.refreshCustomerToken({ refresh_token: refreshToken }).pipe(
      map((res) => {
        const bodyStatus = res?.status ?? res?.Status;
        if (res?.success === false || res?.Success === false || bodyStatus === 401) {
          throw {
            message: extractApiMessage(res) || 'Session expired. Please log in again.',
            status: bodyStatus ?? 401,
            response: res,
            source: 'BACKEND',
          };
        }

        const data = extractApiData(res) ?? res?.data ?? res;
        const accessToken =
          data?.access_token ?? data?.accessToken ?? data?.token ?? null;
        const newRefresh =
          data?.refresh_token ?? data?.refreshToken ?? refreshToken;

        if (!accessToken) {
          throw {
            message: 'Token refresh returned no access_token.',
            source: 'FRONTEND',
            response: res,
          };
        }

        const existing = this.readCustomer();
        const customer = this.mapCustomer(data, existing);

        this.persistSession(accessToken, newRefresh, customer);
        window.dispatchEvent(new Event('auth-updated'));
        return true;
      }),
      catchError((err) => {
        this.clearSession();
        return of(false);
      }),
      finalize(() => {
        this.refreshInFlight$ = null;
      }),
      shareReplay(1)
    );

    return this.refreshInFlight$;
  }

  registerCustomer(payload: RegisterCustomerPayload): Observable<any> {
    const body = this.normalizePhonePayload(payload);

    return this.api.registerCustomer(body).pipe(
      map((res) => this.requireSuccess(res, 'register_customer')),
      catchError((err) => throwError(() => this.toAuthError(err, 'register_customer')))
    );
  }

  requestOtp(payload: PhoneOtpPayload): Observable<RequestOtpResult> {
    const body = this.normalizePhonePayload(payload);

    return this.api.requestOtp(body).pipe(
      map((res) => {
        const data = this.requireSuccess(res, 'request_otp');
        const payloadData = extractApiData(data) ?? data?.data ?? data;
        return {
          message: extractApiMessage(res) || 'OTP sent',
          otp_dev: !environment.production
            ? payloadData?.otp_dev ?? payloadData?.otpDev ?? undefined
            : undefined,
        } as RequestOtpResult;
      }),
      catchError((err) => throwError(() => this.toAuthError(err, 'request_otp')))
    );
  }

  verifyOtp(payload: VerifyOtpPayload): Observable<AuthCustomer> {
    const body = this.normalizePhonePayload(payload);
    return this.api.verifyOtp(body).pipe(
      map((res) => {
        const bodyRes = this.requireSuccess(res, 'verify_otp');
        const data = extractApiData(bodyRes) ?? bodyRes?.data ?? bodyRes;

        const accessToken =
          data?.access_token ?? data?.accessToken ?? data?.token ?? null;
        const refreshToken =
          data?.refresh_token ?? data?.refreshToken ?? null;

        if (!accessToken) {
          throw {
            message: 'Login succeeded but no access token was returned.',
            source: 'FRONTEND',
          };
        }

        const customer = this.mapCustomer(data, {
          country_code: payload.country_code,
          phone_number: payload.phone_number,
        });

        this.persistSession(accessToken, refreshToken, customer);
        return customer;
      }),
      tap(() => {
        // auth-login: cart merges guest localStorage once (not on token refresh).
        window.dispatchEvent(new Event('auth-login'));
        window.dispatchEvent(new Event('auth-updated'));
      }),
      catchError((err) => throwError(() => this.toAuthError(err, 'verify_otp')))
    );
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    this.customerSubject.next(null);
    window.dispatchEvent(new Event('auth-updated'));
  }

  logout(): void {
    this.clearSession();
  }

  /** Refresh local customer from GET /customer/me. */
  refreshCustomerProfile(): Observable<AuthCustomer> {
    return this.api.getCustomerMe().pipe(
      map((res) => {
        const body = this.requireSuccess(res, 'customer_me');
        const data = extractApiData(body) ?? body?.data ?? body;
        const customer = this.mapCustomer(data, this.readCustomer());
        this.persistCustomer(customer);
        return customer;
      }),
      catchError((err) => throwError(() => this.toAuthError(err, 'customer_me')))
    );
  }

  /**
   * Presign → PUT bytes to Wasabi (fetch, no Bearer) → confirm with API.
   * Max 5MB; jpeg/png/webp only.
   */
  uploadProfileImage(file: File): Observable<AuthCustomer> {
    const mapped = this.mapImageFile(file);
    if (!mapped) {
      return throwError(() => ({
        message: 'Use a JPG, PNG, or WebP image under 5MB.',
        source: 'FRONTEND',
      }));
    }

    return this.api
      .presignCustomerProfileImage({
        content_type: mapped.contentType,
        file_ext: mapped.fileExt,
      })
      .pipe(
        map((res) => {
          const body = this.requireSuccess(res, 'profile_image_presign');
          const data = extractApiData(body) ?? body?.data ?? body;
          const uploadUrl = String(data?.upload_url ?? data?.uploadUrl ?? '');
          const publicUrl = String(data?.public_url ?? data?.publicUrl ?? '');
          const objectKey = String(data?.object_key ?? data?.objectKey ?? '');
          if (!uploadUrl || !publicUrl || !objectKey) {
            throw {
              message: 'Presign response missing upload_url / public_url / object_key.',
              source: 'FRONTEND',
              response: res,
            };
          }
          const headers: Record<string, string> = {
            'Content-Type': mapped.contentType,
            ...(data?.headers && typeof data.headers === 'object' ? data.headers : {}),
          };
          return { uploadUrl, publicUrl, objectKey, headers } as ProfileImagePresign & {
            uploadUrl: string;
            publicUrl: string;
            objectKey: string;
            headers: Record<string, string>;
          };
        }),
        switchMap((presign) =>
          from(
            fetch(presign.uploadUrl, {
              method: 'PUT',
              headers: presign.headers,
              body: file,
            }).then(async (resp) => {
              if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                throw {
                  message: `Wasabi upload failed (${resp.status}). ${text}`.trim(),
                  source: 'NETWORK',
                  status: resp.status,
                };
              }
              return presign;
            })
          )
        ),
        switchMap((presign) =>
          this.api.confirmCustomerProfileImage({
            object_key: presign.objectKey,
            public_url: presign.publicUrl,
          })
        ),
        map((res) => {
          const body = this.requireSuccess(res, 'profile_image_confirm');
          const data = extractApiData(body) ?? body?.data ?? body;
          const customer = this.mapCustomer(data, this.readCustomer());
          this.persistCustomer(customer);
          window.dispatchEvent(new Event('auth-updated'));
          return customer;
        }),
        catchError((err) => throwError(() => this.toAuthError(err, 'profile_image_upload')))
      );
  }

  removeProfileImage(): Observable<AuthCustomer> {
    return this.api.deleteCustomerProfileImage().pipe(
      map((res) => {
        const body = this.requireSuccess(res, 'profile_image_delete');
        const data = extractApiData(body) ?? body?.data ?? body ?? {};
        const customer = this.mapCustomer(
          { ...data, profile_image_url: data?.profile_image_url ?? data?.profileImageUrl ?? null },
          this.readCustomer()
        );
        this.persistCustomer(customer);
        window.dispatchEvent(new Event('auth-updated'));
        return customer;
      }),
      catchError((err) => throwError(() => this.toAuthError(err, 'profile_image_delete')))
    );
  }

  updateLocalCustomer(partial: Partial<AuthCustomer>): AuthCustomer | null {
    const current = this.readCustomer();
    if (!current) return null;
    const next: AuthCustomer = {
      ...current,
      ...partial,
      customer_id: String(partial.customer_id ?? current.customer_id),
      full_name: String(partial.full_name ?? current.full_name ?? ''),
    };
    this.persistCustomer(next);
    window.dispatchEvent(new Event('auth-updated'));
    return next;
  }

  normalizePhoneDigits(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  normalizeCountryCode(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+/, '')}`;
  }

  private normalizePhonePayload<T extends { country_code: string; phone_number: string }>(
    payload: T
  ): T {
    return {
      ...payload,
      country_code: this.normalizeCountryCode(payload.country_code),
      phone_number: this.normalizePhoneDigits(payload.phone_number),
    };
  }

  private persistSession(
    accessToken: string,
    refreshToken: string | null,
    customer: AuthCustomer
  ): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    this.persistCustomer(customer);
  }

  private persistCustomer(customer: AuthCustomer): void {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    this.customerSubject.next(customer);
  }

  private mapCustomer(
    data: any,
    fallback?: Partial<AuthCustomer> | null
  ): AuthCustomer {
    const existing = fallback ?? this.readCustomer();
    let profileImage: string | null = existing?.profile_image_url ?? null;
    if (data && ('profile_image_url' in data || 'profileImageUrl' in data)) {
      const raw = data.profile_image_url ?? data.profileImageUrl;
      profileImage = raw ? String(raw) : null;
    }

    return {
      customer_id: String(
        data?.customer_id ?? data?.customerId ?? data?.id ?? existing?.customer_id ?? ''
      ),
      full_name: String(
        data?.full_name ?? data?.fullName ?? existing?.full_name ?? ''
      ),
      email: data?.email ?? existing?.email,
      country_code:
        data?.country_code ?? data?.countryCode ?? existing?.country_code,
      phone_number:
        data?.phone_number ?? data?.phoneNumber ?? existing?.phone_number,
      profile_image_url: profileImage,
    };
  }

  private mapImageFile(
    file: File
  ): { contentType: string; fileExt: string } | null {
    if (!file || file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return null;
    }

    const type = String(file.type || '').toLowerCase();
    const nameExt = String(file.name || '')
      .split('.')
      .pop()
      ?.toLowerCase();

    if (type === 'image/jpeg' || nameExt === 'jpg' || nameExt === 'jpeg') {
      return { contentType: 'image/jpeg', fileExt: nameExt === 'jpeg' ? 'jpeg' : 'jpg' };
    }
    if (type === 'image/png' || nameExt === 'png') {
      return { contentType: 'image/png', fileExt: 'png' };
    }
    if (type === 'image/webp' || nameExt === 'webp') {
      return { contentType: 'image/webp', fileExt: 'webp' };
    }
    return null;
  }

  private readCustomer(): AuthCustomer | null {
    try {
      const raw = localStorage.getItem(CUSTOMER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthCustomer;
    } catch {
      return null;
    }
  }

  private requireSuccess(res: any, action: string): any {
    if (res?.success === false || res?.Success === false) {
      const message = extractApiMessage(res) || 'Request failed';
      throw {
        message,
        response: res,
        status: res?.status ?? res?.Status,
        source: 'BACKEND',
      };
    }
    return res;
  }

  private toAuthError(
    err: any,
    action: string
  ): { message: string; status?: number; source: string; hint: string; raw?: any } {
    const status = err?.status ?? err?.raw?.status ?? err?.response?.status;
    const apiMessage =
      extractApiMessage(err?.error) ||
      err?.error?.message ||
      err?.error?.Message ||
      err?.message;

    let source = err?.source || 'UNKNOWN';
    let hint = '';

    if (err?.source === 'FRONTEND' || err?.source === 'BACKEND') {
      source = err.source;
      hint =
        source === 'FRONTEND'
          ? 'Problem in frontend parsing/validation.'
          : 'API responded with success=false.';
    } else if (status === 0 || err?.status === 0) {
      source = 'NETWORK';
      hint =
        'Cannot reach API. Check backend is running, CORS, and ApiUrl in environments.ts.';
    } else if (typeof status === 'number' && status >= 400) {
      source = 'BACKEND';
      hint = `HTTP ${status} from API. Check Network tab response body.`;
    } else if (err?.name === 'HttpErrorResponse') {
      source = 'NETWORK/BACKEND';
      hint = 'HttpErrorResponse without clear status — see raw error below.';
    } else {
      source = 'FRONTEND';
      hint = 'Error thrown before/after HTTP (validation or response mapping).';
    }

    const message = apiMessage || 'Something went wrong. Please try again.';

    return {
      message,
      status,
      source,
      hint,
      raw: err,
    };
  }
}
