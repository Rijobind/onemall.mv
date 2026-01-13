import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/home/pages/home/home').then(a => a.Home) },
    { path: 'product-details', loadComponent: () => import('./features/products/pages/product-details/product-details').then(a => a.ProductDetails) },
    { path: 'shop-details', loadComponent: () => import('./features/shop/pages/shop-details/shop-details').then(a => a.ShopDetails) },

];
