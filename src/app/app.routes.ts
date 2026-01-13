import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/home/pages/home/home').then(a => a.Home) },
    { path: 'product-details', loadComponent: () => import('./features/products/pages/product-details/product-details').then(a => a.ProductDetails) },

];
