import { Routes } from '@angular/router';

/** Default browser tab title — keep in sync with src/index.html */
export const DEFAULT_APP_TITLE =
  "OneMall | Online Shopping Site in Male` | Shop Online for Mobiles, Laptops and etc..";

export const routes: Routes = [
    { path: '', title: DEFAULT_APP_TITLE, loadComponent: () => import('./features/home/pages/home/home').then(a => a.Home) },
    { path: 'categories', title: 'Categories | OneMall', loadComponent: () => import('./features/cart/pages/categories/categories').then(a => a.Categories) },
    {
      path: 'product/:slug',
      title: 'Product | OneMall',
      loadComponent: () =>
        import('./features/products/pages/product-details/product-details').then(
          (a) => a.ProductDetails
        ),
    },
    // Legacy query-param URL — same component redirects to /product/{slug}
    {
      path: 'product-details',
      title: 'Product | OneMall',
      loadComponent: () =>
        import('./features/products/pages/product-details/product-details').then(
          (a) => a.ProductDetails
        ),
    },
    { path: 'shop-details', title: 'Shop | OneMall', loadComponent: () => import('./features/shop/pages/shop-details/shop-details').then(a => a.ShopDetails) },
    { path: 'notification-item', title: 'Notifications | OneMall', loadComponent: () => import('./features/notifications/notification-item/notification-item').then(a => a.NotificationItem) },
    { path: 'favorite-products', title: 'Favorites | OneMall', loadComponent: () => import('./features/favorites/favorite-product/favorite-product').then(a => a.FavoriteProduct) },
    { path: 'cart', title: 'Cart | OneMall', loadComponent: () => import('./features/cart/pages/cart/cart').then(a => a.Cart) },
    { path: 'quotation', title: 'Quotation | OneMall', loadComponent: () => import('./features/cart/pages/quotation/quotation').then(a => a.Quotation) },
    { path: 'about-us', title: 'About Us | OneMall', loadComponent: () => import('./features/pages/about-us/about-us').then(a => a.AboutUs) },
    { path: 'contact', title: 'Contact | OneMall', loadComponent: () => import('./features/pages/contact-us/contact-us').then(a => a.ContactUs) },
    { path: 'customer-profile', title: 'My Account | OneMall', loadComponent: () => import('./features/pages/customer-profile/customer-profile').then(a => a.CustomerProfile) },
    { path: 'add-address', title: 'Add Address | OneMall', loadComponent: () => import('./features/pages/add-address/add-address').then(a => a.AddAddress) },
    { path: 'product-list', title: 'Products | OneMall', loadComponent: () => import('./features/products/pages/product-list/product-list').then(a => a.ProductList) },
    { path: 'search-result', title: 'Search | OneMall', loadComponent: () => import('./features/products/search-result/search-result').then(a => a.SearchResult) },

];
