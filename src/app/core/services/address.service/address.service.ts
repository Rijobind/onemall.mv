import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../auth.service/auth.service';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import {
  extractApiData,
  extractApiList,
  extractApiMessage,
  isApiSuccess,
} from '../../utils/api-response.util';

export type AddressType = 'HOME' | 'WORK' | 'OTHER' | string;

export interface CustomerAddress {
  address_id: string;
  mk_customer_id?: string;
  address_type?: AddressType | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  address_line1: string;
  land_mark?: string | null;
  city: string;
  state_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  zone_id?: string | null;
  is_default: boolean;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CustomerAddressPayload {
  address_type?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  address_line1: string;
  land_mark?: string | null;
  city: string;
  state_region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  zone_id?: string | null;
  is_default?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

const ADD_ADDRESS_PATH = '/add-address';

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  /** Cached “has at least one address” flag for the current session. */
  private hasAddressesCache: boolean | null = null;
  private checkInFlight = false;

  constructor(
    private api: BackendapiServices,
    private auth: AuthService,
    private router: Router
  ) {
    if (typeof window !== 'undefined') {
      // Fresh login only — not token refresh.
      window.addEventListener('auth-login', () => {
        this.checkAndRedirectIfMissing();
      });
      window.addEventListener('auth-updated', () => {
        if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
          this.hasAddressesCache = null;
        }
      });
    }
  }

  /** Call after session restore so returning users without an address are nudged. */
  checkAfterSessionRestore(): void {
    if (!this.auth.isLoggedIn) return;
    this.checkAndRedirectIfMissing();
  }

  /** Invalidate local has-address cache (e.g. after create/delete). */
  invalidateCache(): void {
    this.hasAddressesCache = null;
  }

  hasAddresses(): Observable<boolean> {
    if (!this.auth.isLoggedIn) {
      return of(false);
    }
    if (this.hasAddressesCache === true) {
      return of(true);
    }

    return this.api.customerHasAddresses().pipe(
      map((res) => {
        const data = extractApiData(res);
        const has =
          data === true ||
          data === 'true' ||
          data?.has_address === true ||
          data?.hasAddress === true;
        this.hasAddressesCache = has;
        return has;
      }),
      catchError(() => {
        this.hasAddressesCache = null;
        return of(false);
      })
    );
  }

  listAddresses(): Observable<CustomerAddress[]> {
    if (!this.auth.isLoggedIn) return of([]);

    return this.api.getCustomerAddresses().pipe(
      map((res) => {
        if (!isApiSuccess(res) && extractApiList(res).length === 0) return [];
        return extractApiList(res)
          .map((row) => this.normalizeAddress(row))
          .filter((a): a is CustomerAddress => !!a?.address_id);
      }),
      catchError(() => of([]))
    );
  }

  getAddress(addressId: string): Observable<CustomerAddress | null> {
    if (!this.auth.isLoggedIn || !addressId) return of(null);

    return this.api.getCustomerAddressById(addressId).pipe(
      map((res) => {
        const data = extractApiData(res) ?? res;
        return this.normalizeAddress(data);
      }),
      catchError(() => of(null))
    );
  }

  createAddress(payload: CustomerAddressPayload): Observable<{
    ok: boolean;
    address: CustomerAddress | null;
    message: string;
  }> {
    return this.api.createCustomerAddress({ ...payload }).pipe(
      map((res) => {
        const ok = isApiSuccess(res) || res?.success === true;
        const data = extractApiData(res) ?? res?.data;
        if (ok) {
          this.hasAddressesCache = true;
        }
        return {
          ok,
          address: this.normalizeAddress(data),
          message: extractApiMessage(res) || (ok ? 'Address saved' : 'Could not save address'),
        };
      }),
      catchError((err) =>
        of({
          ok: false,
          address: null,
          message: this.readErrorMessage(err),
        })
      )
    );
  }

  updateAddress(
    addressId: string,
    payload: Partial<CustomerAddressPayload>
  ): Observable<{ ok: boolean; address: CustomerAddress | null; message: string }> {
    return this.api
      .updateCustomerAddress(addressId, { ...payload })
      .pipe(
        map((res) => {
          const ok = isApiSuccess(res) || res?.success === true;
          const data = extractApiData(res) ?? res?.data;
          return {
            ok,
            address: this.normalizeAddress(data),
            message:
              extractApiMessage(res) || (ok ? 'Address updated' : 'Could not update address'),
          };
        }),
        catchError((err) =>
          of({
            ok: false,
            address: null,
            message: this.readErrorMessage(err),
          })
        )
      );
  }

  setDefault(addressId: string): Observable<{ ok: boolean; message: string }> {
    return this.api.setCustomerAddressDefault(addressId).pipe(
      map((res) => {
        const ok = isApiSuccess(res) || res?.success === true || res?.data === true;
        return {
          ok,
          message: extractApiMessage(res) || (ok ? 'Default address updated' : 'Could not set default'),
        };
      }),
      catchError((err) =>
        of({
          ok: false,
          message: this.readErrorMessage(err),
        })
      )
    );
  }

  deleteAddress(addressId: string): Observable<{ ok: boolean; message: string }> {
    return this.api.deleteCustomerAddress(addressId).pipe(
      tap(() => this.invalidateCache()),
      map((res) => {
        const ok = isApiSuccess(res) || res?.success === true || res?.data === true;
        return {
          ok,
          message: extractApiMessage(res) || (ok ? 'Address removed' : 'Could not delete address'),
        };
      }),
      catchError((err) =>
        of({
          ok: false,
          message: this.readErrorMessage(err),
        })
      )
    );
  }

  /** Prefill helpers from logged-in profile. */
  profileContactName(): string {
    return String(this.auth.customer?.full_name || '').trim();
  }

  profileContactPhone(): string {
    const c = this.auth.customer;
    if (!c) return '';
    const dial = String(c.country_code || '').trim();
    const phone = String(c.phone_number || '').trim();
    if (!dial && !phone) return '';
    if (phone.startsWith('+')) return phone;
    return `${dial}${phone}`.trim();
  }

  private checkAndRedirectIfMissing(): void {
    if (!this.auth.isLoggedIn || this.checkInFlight) return;

    const path = this.router.url.split('?')[0];
    if (path === ADD_ADDRESS_PATH) return;

    this.checkInFlight = true;
    this.hasAddresses()
      .pipe(
        tap((has) => {
          this.checkInFlight = false;
          if (!has) {
            this.router.navigate([ADD_ADDRESS_PATH], {
              queryParams: { required: '1' },
            });
          }
        }),
        catchError(() => {
          this.checkInFlight = false;
          return of(false);
        })
      )
      .subscribe();
  }

  private normalizeAddress(row: any): CustomerAddress | null {
    if (!row || typeof row !== 'object') return null;
    const addressId = String(
      row.address_id ?? row.addressId ?? row.id ?? ''
    ).trim();
    if (!addressId) return null;

    const line1 = String(row.address_line1 ?? row.addressLine1 ?? '').trim();
    const city = String(row.city ?? '').trim();

    return {
      address_id: addressId,
      mk_customer_id: row.mk_customer_id ?? row.mkCustomerId ?? undefined,
      address_type: row.address_type ?? row.addressType ?? null,
      contact_name: row.contact_name ?? row.contactName ?? null,
      contact_phone: row.contact_phone ?? row.contactPhone ?? null,
      address_line1: line1,
      land_mark: row.land_mark ?? row.landMark ?? null,
      city,
      state_region: row.state_region ?? row.stateRegion ?? null,
      postal_code: row.postal_code ?? row.postalCode ?? null,
      country_code: row.country_code ?? row.countryCode ?? null,
      zone_id: row.zone_id ?? row.zoneId ?? null,
      is_default: !!(row.is_default ?? row.isDefault),
      status: row.status ?? null,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      created_at: row.created_at ?? row.createdAt ?? null,
      updated_at: row.updated_at ?? row.updatedAt ?? null,
    };
  }

  private readErrorMessage(err: any): string {
    const body = err?.error;
    const msg = extractApiMessage(body);
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
    if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
    const status = err?.status;
    if (status === 401) return 'Please sign in again.';
    if (status === 404) return 'Address not found.';
    if (status === 400) return 'Invalid address details.';
    if (status >= 500) return 'Server error. Please try again.';
    return 'Something went wrong. Please try again.';
  }
}
