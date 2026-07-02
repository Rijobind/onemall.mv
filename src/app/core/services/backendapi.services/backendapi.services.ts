import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environments';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, switchMap, of, catchError } from 'rxjs';
import { MarketplaceProductParams } from '../region.service/region.service';
import { extractApiList, isApiSuccess } from '../../utils/api-response.util';

@Injectable({
  providedIn: 'root',
})
export class BackendapiServices {
  apiUrl: string = environment.ApiUrl;

  constructor(private http: HttpClient) {}

  getAllCategoryList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Category/product_category_list`);
  }

  getMarketplaceProducts(params?: MarketplaceProductParams): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.country_region_id) {
      httpParams = httpParams.set('country_region_id', params.country_region_id);
    }
    if (params?.region_name) {
      httpParams = httpParams.set('region_name', params.region_name);
    }
    if (params?.city) {
      httpParams = httpParams.set('city', params.city);
    }
    return this.http.get(`${this.apiUrl}/Market_place/get_marketplace_products`, {
      params: httpParams,
    });
  }

  getMarketplaceProductsWithFallback(params?: MarketplaceProductParams): Observable<any> {
    return this.getMarketplaceProducts(params).pipe(
      switchMap((res: any) => {
        if (isApiSuccess(res) && extractApiList(res).length > 0) {
          return of(res);
        }
        if (!params?.country_region_id && !params?.region_name && !params?.city) {
          return of(res);
        }
        return this.getMarketplaceProducts();
      }),
      catchError(() => this.getMarketplaceProducts())
    );
  }

  getMarketplaceRegions(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/get_marketplace_regions`);
  }

  getMarketplaceCities(countryRegionId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/Market_place/get_marketplace_cities/${countryRegionId}`
    );
  }

  getAdminRegionsList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Admin/regions_list`);
  }

  getstores(store_id: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/store/get_sotore_deatils/${store_id}`);
  }

  extractProductsFromResponse(response: any): any[] {
    if (!isApiSuccess(response)) return [];
    return extractApiList(response);
  }
}
