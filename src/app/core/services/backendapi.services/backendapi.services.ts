import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environments';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class BackendapiServices {
  private _refreshNeeded$ = new Subject<void>();
  apiUrl: string = environment.ApiUrl;

  constructor(private http: HttpClient) {}

  getAllCategoryList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Category/product_category_list`);
  }

  getAllProductList(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/im_product/get_product_list`,
      this.getAuthorizedRequestOptions(),
    );
  }

  Category_list(): Observable<any> {
    return this.http.get(`${environment.ApiUrl}/Category/product_category_list`).pipe(
      tap(() => {
        this._refreshNeeded$.next();
      }),
    );
  }

  getProductDetails(productId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/im_product/get_single_product_details/${productId}`,
      this.getAuthorizedRequestOptions(),
    );
  }

  getMultilevelProductDetails(productId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/im_product/get_multilevel_product_details/${productId}`,
      this.getAuthorizedRequestOptions(),
    );
  }

  Add_StoreCategories(data: any): Observable<any> {
    return this.http.post(environment.ApiUrl + '/Category/add_StoreCategories', data).pipe(
      tap(() => {
        this._refreshNeeded$.next();
      }),
    );
  }

  Store_details(store_id: any): Observable<any> {
    return this.http.get(`${environment.ApiUrl}/store/get_store_by_storeid/${store_id}`).pipe(
      tap(() => {
        this._refreshNeeded$.next();
      }),
    );
  }

  private getAuthorizedRequestOptions() {
    const token = this.getStoredToken();
    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return {
      headers,
      withCredentials: true,
    };
  }

  private getStoredToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const tokenKeys = ['accessToken', 'token', 'authToken', 'jwtToken'];

    for (const key of tokenKeys) {
      const rawValue = localStorage.getItem(key) || sessionStorage.getItem(key);
      const parsed = this.extractTokenValue(rawValue);
      if (parsed) {
        return parsed;
      }
    }

    const userRaw =
      localStorage.getItem('user') ||
      sessionStorage.getItem('user') ||
      localStorage.getItem('auth') ||
      sessionStorage.getItem('auth');
    const parsedUserToken = this.extractTokenFromJson(userRaw);
    return parsedUserToken || null;
  }

  private extractTokenValue(rawValue: string | null): string | null {
    if (!rawValue) return null;

    // Plain token string
    if (!rawValue.startsWith('{') && !rawValue.startsWith('[')) {
      return rawValue;
    }

    // JSON payload that might contain a token field
    return this.extractTokenFromJson(rawValue);
  }

  private extractTokenFromJson(rawJson: string | null): string | null {
    if (!rawJson) return null;
    try {
      const parsed = JSON.parse(rawJson);
      return (
        parsed?.accessToken ||
        parsed?.token ||
        parsed?.authToken ||
        parsed?.jwtToken ||
        parsed?.data?.accessToken ||
        parsed?.data?.token ||
        null
      );
    } catch {
      return null;
    }
  }
}
