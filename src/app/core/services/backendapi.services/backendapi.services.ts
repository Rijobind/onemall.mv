import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environments';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

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
    return this.http.get(`${this.apiUrl}/im_product/get_product_list`);
  }

}
