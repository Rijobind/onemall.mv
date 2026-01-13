import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./features/home/pages/home/home').then(a => a.Home) },
    { path: 'product-details', loadComponent: () => import('./features/products/pages/product-details/product-details').then(a => a.ProductDetails) },
    { path: 'shop-details', loadComponent: () => import('./features/shop/pages/shop-details/shop-details').then(a => a.ShopDetails) },
    { path: 'notification-item', loadComponent: () => import('./features/notifications/notification-item/notification-item').then(a => a.NotificationItem) },
    { path: 'favorite-products', loadComponent: () => import('./features/favorites/favorite-product/favorite-product').then(a => a.FavoriteProduct) },
    { path: 'cart', loadComponent: () => import('./features/cart/pages/cart/cart').then(a => a.Cart) },
    { path: 'about-us', loadComponent: () => import('./features/pages/about-us/about-us').then(a => a.AboutUs) },
    { path: 'contact', loadComponent: () => import('./features/pages/contact-us/contact-us').then(a => a.ContactUs) },

];
