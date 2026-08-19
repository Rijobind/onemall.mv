import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../auth.service/auth.service';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { extractApiData } from '../../utils/api-response.util';

export interface NotificationPreviewProduct {
  product_id: string;
  product_name: string;
  image_url: string;
  quantity: number;
  unit_price: number;
  store_name?: string;
}

export interface NotificationPreviewStore {
  store_id: string;
  store_name: string;
}

export interface NotificationPreview {
  quotation_id?: string;
  quotation_no?: string;
  currency_code?: string;
  currency_symbol?: string;
  item_count?: number;
  store_count?: number;
  total?: number;
  stores: NotificationPreviewStore[];
  products: NotificationPreviewProduct[];
}

export interface CustomerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  linkPath?: string;
  referenceType?: string;
  referenceId?: string;
  read: boolean;
  createdAt: string;
  time: string;
  preview?: NotificationPreview | null;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly unreadSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadSubject.asObservable();

  constructor(
    private api: BackendapiServices,
    private auth: AuthService
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-updated', () => this.refreshUnreadCount());
      window.addEventListener('notifications-updated', () => this.refreshUnreadCount());
    }
  }

  get unreadCount(): number {
    return this.unreadSubject.value;
  }

  refreshUnreadCount(): void {
    if (!this.auth.isLoggedIn) {
      this.unreadSubject.next(0);
      return;
    }

    this.api.getCustomerNotificationUnreadCount().subscribe({
      next: (res) => {
        const data = extractApiData(res) ?? res?.data ?? res;
        const count = Number(
          data?.unread_count ?? data?.unreadCount ?? data?.count ?? 0
        );
        this.unreadSubject.next(Number.isFinite(count) ? count : 0);
      },
      error: () => this.unreadSubject.next(0),
    });
  }

  loadNotifications(params?: {
    unread_only?: boolean;
    page?: number;
    page_size?: number;
  }): Observable<{
    items: CustomerNotification[];
    unreadCount: number;
    totalCount: number;
  }> {
    if (!this.auth.isLoggedIn) {
      return of({ items: [], unreadCount: 0, totalCount: 0 });
    }

    return this.api.getCustomerNotifications(params).pipe(
      map((res) => {
        const data = extractApiData(res) ?? res?.data ?? {};
        const rawItems = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        const items: CustomerNotification[] = rawItems.map((row: any) =>
          this.mapItem(row)
        );
        const unreadCount = Number(
          data?.unread_count ??
            data?.unreadCount ??
            items.filter((i: CustomerNotification) => !i.read).length
        );
        const totalCount = Number(data?.total_count ?? data?.totalCount ?? items.length);
        return {
          items,
          unreadCount: Number.isFinite(unreadCount) ? unreadCount : 0,
          totalCount: Number.isFinite(totalCount) ? totalCount : items.length,
        };
      }),
      tap((result) => this.unreadSubject.next(result.unreadCount)),
      catchError(() => of({ items: [], unreadCount: 0, totalCount: 0 }))
    );
  }

  markRead(notificationId: string): Observable<boolean> {
    return this.api.markCustomerNotificationRead(notificationId).pipe(
      map((res) => res?.success !== false && res?.Success !== false),
      tap((ok) => {
        if (ok) this.emitUpdated();
      }),
      catchError(() => of(false))
    );
  }

  markAllRead(): Observable<boolean> {
    return this.api.markAllCustomerNotificationsRead().pipe(
      map((res) => res?.success !== false && res?.Success !== false),
      tap((ok) => {
        if (ok) {
          this.unreadSubject.next(0);
          this.emitUpdated();
        }
      }),
      catchError(() => of(false))
    );
  }

  delete(notificationId: string): Observable<boolean> {
    return this.api.deleteCustomerNotification(notificationId).pipe(
      map((res) => res?.success !== false && res?.Success !== false),
      tap((ok) => {
        if (ok) this.emitUpdated();
      }),
      catchError(() => of(false))
    );
  }

  private emitUpdated(): void {
    this.refreshUnreadCount();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('notifications-updated'));
    }
  }

  private mapItem(row: any): CustomerNotification {
    const createdAt = String(row?.created_at ?? row?.createdAt ?? '');
    return {
      id: String(row?.notification_id ?? row?.notificationId ?? row?.id ?? ''),
      type: String(row?.type || 'system').toLowerCase(),
      title: String(row?.title || 'Notification'),
      message: String(row?.message || ''),
      linkPath: row?.link_path ?? row?.linkPath ?? undefined,
      referenceType: row?.reference_type ?? row?.referenceType ?? undefined,
      referenceId: row?.reference_id ?? row?.referenceId
        ? String(row?.reference_id ?? row?.referenceId)
        : undefined,
      read: !!(row?.is_read ?? row?.isRead ?? row?.read),
      createdAt,
      time: this.formatRelativeTime(createdAt),
      preview: this.mapPreview(row?.preview ?? row?.preview_json ?? row?.previewJson),
    };
  }

  private mapPreview(raw: any): NotificationPreview | null {
    if (!raw) return null;

    let data = raw;
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!data || typeof data !== 'object') return null;

    const storesRaw = Array.isArray(data.stores) ? data.stores : [];
    const productsRaw = Array.isArray(data.products) ? data.products : [];

    let stores: NotificationPreviewStore[] = storesRaw
      .map((s: any) => ({
        store_id: String(s?.store_id ?? s?.storeId ?? ''),
        store_name: String(s?.store_name ?? s?.storeName ?? 'Shop'),
      }))
      .filter((s: NotificationPreviewStore) => !!s.store_name);

    let products: NotificationPreviewProduct[] = productsRaw.map((p: any) => ({
      product_id: String(p?.product_id ?? p?.productId ?? ''),
      product_name: String(p?.product_name ?? p?.productName ?? 'Product'),
      image_url: String(p?.image_url ?? p?.imageUrl ?? '/mobile.jpg') || '/mobile.jpg',
      quantity: Math.max(1, Number(p?.quantity) || 1),
      unit_price: Number(p?.unit_price ?? p?.unitPrice ?? p?.price) || 0,
      store_name: (p?.store_name ?? p?.storeName) || undefined,
    }));

    // new_product follower notifications use a flat camelCase preview object
    if (!stores.length && !products.length) {
      const productId = String(data.productId ?? data.product_id ?? '');
      const productName = String(data.productName ?? data.product_name ?? '');
      const storeId = String(data.storeId ?? data.store_id ?? '');
      const storeName = String(data.storeName ?? data.store_name ?? '');
      if (productId || productName) {
        products = [
          {
            product_id: productId,
            product_name: productName || 'Product',
            image_url:
              String(data.imageUrl ?? data.image_url ?? '/mobile.jpg') || '/mobile.jpg',
            quantity: 1,
            unit_price: Number(data.price) || 0,
            store_name: storeName || undefined,
          },
        ];
      }
      if (storeName) {
        stores = [
          {
            store_id: storeId,
            store_name: storeName,
          },
        ];
      }
    }

    if (!stores.length && !products.length) return null;

    return {
      quotation_id: (data.quotation_id ?? data.quotationId) || undefined,
      quotation_no: (data.quotation_no ?? data.quotationNo) || undefined,
      currency_code: (data.currency_code ?? data.currencyCode) || undefined,
      currency_symbol: (data.currency_symbol ?? data.currencySymbol) || undefined,
      item_count: Number(data.item_count ?? data.itemCount) || products.length || undefined,
      store_count: Number(data.store_count ?? data.storeCount) || stores.length || undefined,
      total: Number(data.total) || undefined,
      stores,
      products,
    };
  }

  private formatRelativeTime(iso: string): string {
    if (!iso) return '';
    const date = this.parseApiDate(iso);
    if (Number.isNaN(date.getTime())) return iso;

    // Clamp small future skew (clock drift) to "Just now"
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  /** API UTC timestamps often omit `Z`; browsers then treat them as local and skew relative time. */
  private parseApiDate(iso: string): Date {
    const s = String(iso).trim();
    if (!s) return new Date(NaN);
    // Already has timezone (Z or ±offset)
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return new Date(s);
    }
    // Date-only or datetime without timezone → treat as UTC
    if (/^\d{4}-\d{2}-\d{2}([T\s].*)?$/.test(s)) {
      const normalized = s.includes('T') ? s : s.replace(' ', 'T');
      return new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
    }
    return new Date(s);
  }
}
