import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environments';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BackendapiServices {
  apiUrl: string = environment.ApiUrl;

  constructor(private http: HttpClient) {}

  getAllCategoryList(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Category/product_category_list`);
  }

  getMarketplaceProducts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/Market_place/get_marketplace_products`);
  }

  getstores(store_id: any): Observable<any> {
    return this.http.get(`${this.apiUrl}/store/get_sotore_deatils/${store_id}`);
  }

}
