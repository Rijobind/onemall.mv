import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BackendapiServices } from '../backendapi.services/backendapi.services';
import { AuthService } from '../auth.service/auth.service';
import { extractApiData, extractApiList, isApiSuccess } from '../../utils/api-response.util';

export interface FollowedStore {
  follow_id: string;
  store_id: string;
  store_name: string;
  store_location: string;
  store_type: string;
  default_currency: string;
  status: string;
  followed_at: string;
}

export interface StoreFollowStatus {
  store_id: string;
  is_following: boolean;
  follower_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class FollowService {
  constructor(
    private api: BackendapiServices,
    private auth: AuthService
  ) {}

  isAuthenticated(): boolean {
    return this.auth.isLoggedIn || this.auth.hasSavedSession;
  }

  requestSignIn(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-signin'));
    }
  }

  getFollowedStores(): Observable<FollowedStore[]> {
    if (!this.isAuthenticated()) {
      return of([]);
    }

    return this.api.getCustomerFollows().pipe(
      map((res) => {
        const data = extractApiData(res);
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : extractApiList(res);
        return list.map((row: any) => this.mapFollowedStore(row));
      }),
      catchError(() => of([]))
    );
  }

  getFollowStatus(storeId: string): Observable<StoreFollowStatus> {
    const normalizedId = String(storeId || '').trim();
    if (!normalizedId) {
      return of({ store_id: '', is_following: false, follower_count: 0 });
    }

    return this.api.getStoreFollowStatus(normalizedId).pipe(
      map((res) => {
        const data = extractApiData(res) ?? res?.data ?? {};
        return {
          store_id: String(data?.store_id ?? data?.storeId ?? normalizedId),
          is_following: !!(data?.is_following ?? data?.isFollowing),
          follower_count: Math.max(
            0,
            Number(data?.follower_count ?? data?.followerCount ?? 0) || 0
          ),
        };
      }),
      catchError(() =>
        of({ store_id: normalizedId, is_following: false, follower_count: 0 })
      )
    );
  }

  /**
   * Toggle follow. Guests get sign-in prompt.
   * Returns resulting is_following state, or 'login_required'.
   */
  toggleFollow(storeId: string, currentlyFollowing: boolean): Observable<boolean | 'login_required'> {
    const normalizedId = String(storeId || '').trim();
    if (!normalizedId) {
      return of(currentlyFollowing);
    }

    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return of('login_required');
    }

    if (currentlyFollowing) {
      return this.api.unfollowStore(normalizedId).pipe(
        map((res) => (isApiSuccess(res) || res?.success !== false ? false : true)),
        catchError(() => of(true))
      );
    }

    return this.api.followStore({ store_id: normalizedId }).pipe(
      map((res) => (isApiSuccess(res) || res?.success !== false ? true : false)),
      catchError(() => of(false))
    );
  }

  follow(storeId: string): Observable<boolean> {
    const normalizedId = String(storeId || '').trim();
    if (!normalizedId) return of(false);
    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return of(false);
    }

    return this.api.followStore({ store_id: normalizedId }).pipe(
      map((res) => res?.success !== false && res?.Success !== false),
      catchError(() => of(false))
    );
  }

  unfollow(storeId: string): Observable<boolean> {
    const normalizedId = String(storeId || '').trim();
    if (!normalizedId) return of(false);
    if (!this.isAuthenticated()) {
      this.requestSignIn();
      return of(false);
    }

    return this.api.unfollowStore(normalizedId).pipe(
      map((res) => res?.success !== false && res?.Success !== false),
      catchError(() => of(false))
    );
  }

  private mapFollowedStore(row: any): FollowedStore {
    return {
      follow_id: String(row?.follow_id ?? row?.followId ?? ''),
      store_id: String(row?.store_id ?? row?.storeId ?? ''),
      store_name: String(row?.store_name ?? row?.storeName ?? 'Store'),
      store_location: String(row?.store_location ?? row?.storeLocation ?? ''),
      store_type: String(row?.store_type ?? row?.storeType ?? ''),
      default_currency: String(row?.default_currency ?? row?.defaultCurrency ?? ''),
      status: String(row?.status ?? ''),
      followed_at: String(row?.followed_at ?? row?.followedAt ?? ''),
    };
  }
}
