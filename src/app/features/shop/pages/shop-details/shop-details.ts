import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { ShopProducts } from "../shop-products/shop-products";
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-shop-details',
  imports: [CommonModule, RouterModule, Header, Footer, ShopProducts],
  templateUrl: './shop-details.html',
  styleUrl: './shop-details.css',
})
export class ShopDetails implements OnInit {
  private readonly fallbackShop = {
    id: 1,
    name: 'Premium Electronics',
    description: 'Your trusted source for premium electronics and tech accessories. We offer the latest gadgets, accessories, and tech solutions for your everyday needs.',
    logo: '/shirt.jpg',
    coverImage: '/mobile3.jpg',
    rating: 4.8,
    reviews: 2540,
    responseRate: 98,
    responseTime: 'Within 1 hour',
    itemsSold: 15200,
    followers: 8500,
    joinedDate: 'January 2020',
    location: 'New York, USA',
    verified: true
  };
  private allApiProducts: any[] = [];
  private categoryLookup: Map<string, string> = new Map();
  selectedCategory: string = 'all';
  sortBy: string = 'newest';
  currentStoreId: string = '';
  isShopDataFromApi: boolean = false;

  shop = { ...this.fallbackShop };

  categories: Array<{ id: string; name: string; count: number; isApiData?: boolean }> = [];

  allProducts = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 6,
      name: 'USB-C Hub Multi-Port Adapter',
      price: 34.99,
      originalPrice: 49.99,
      rating: 4.2,
      reviews: 780,
      sold: 520,
      image: '/Categories2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 7,
      name: 'Smart Watch Fitness Tracker',
      price: 149.99,
      originalPrice: 199.99,
      rating: 4.5,
      reviews: 2100,
      sold: 1500,
      image: '/mobile.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 8,
      name: 'Portable External SSD 1TB',
      price: 99.99,
      originalPrice: 149.99,
      rating: 4.8,
      reviews: 1890,
      sold: 1350,
      image: '/ps5.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 9,
      name: 'Wireless Charging Pad Fast',
      price: 24.99,
      originalPrice: 39.99,
      rating: 4.3,
      reviews: 1120,
      sold: 890,
      image: '/mobile2.jpg',
      category: 'mobile',
      inStock: true
    },
    {
      id: 10,
      name: 'HD Webcam 1080p with Microphone',
      price: 59.99,
      originalPrice: 79.99,
      rating: 4.6,
      reviews: 2430,
      sold: 1800,
      image: '/Categories2.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 11,
      name: 'Gaming Headset with Surround Sound',
      price: 89.99,
      originalPrice: 119.99,
      rating: 4.7,
      reviews: 3200,
      sold: 2500,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 12,
      name: 'Laptop Cooling Pad with LED',
      price: 39.99,
      originalPrice: 59.99,
      rating: 4.2,
      reviews: 980,
      sold: 720,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    }
  ];

  get filteredProducts() {
    if (this.selectedCategory === 'all') {
      return this.allProducts;
    }
    return this.allProducts.filter(product => product.category === this.selectedCategory);
  }

  get sortedProducts() {
    const products = [...this.filteredProducts];
    switch (this.sortBy) {
      case 'price-low':
        return products.sort((a, b) => a.price - b.price);
      case 'price-high':
        return products.sort((a, b) => b.price - a.price);
      case 'rating':
        return products.sort((a, b) => b.rating - a.rating);
      case 'newest':
      default:
        return products;
    }
  }

  constructor(
    private backendapiServices: BackendapiServices,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.currentStoreId = this.getStoreIdForApi();
    this.loadCategoryMapAndData();
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
  }

  onSortChange(sortValue: string) {
    this.sortBy = sortValue;
  }

  private loadApiDataInConsole() {
    this.backendapiServices.Store_details(this.currentStoreId).subscribe({
      next: (response) => {
        const payload = response?.data ?? response ?? {};
        this.isShopDataFromApi = true;
        this.shop = {
          ...this.fallbackShop,
          id: payload?.store_id ?? payload?.storeId ?? this.currentStoreId,
          name: payload?.store_name || payload?.name || this.fallbackShop.name,
          description: payload?.description || this.fallbackShop.description,
          logo: payload?.logo || payload?.logo_url || payload?.image || this.fallbackShop.logo,
          rating: Number(payload?.rating || payload?.average_rating || this.fallbackShop.rating),
          reviews: Number(payload?.reviews || payload?.review_count || payload?.total_reviews || this.fallbackShop.reviews),
          responseRate: Number(payload?.response_rate || this.fallbackShop.responseRate),
          responseTime: payload?.response_time || this.fallbackShop.responseTime,
          itemsSold: Number(payload?.items_sold || payload?.total_sold || payload?.sold_count || this.fallbackShop.itemsSold),
          followers: Number(payload?.followers || payload?.follower_count || this.fallbackShop.followers),
          joinedDate: payload?.joined_date || payload?.created_at || this.fallbackShop.joinedDate,
          location: payload?.location || payload?.address || this.fallbackShop.location,
          verified: payload?.verified === undefined ? this.fallbackShop.verified : !!payload.verified
        };
      },
      error: () => {
        this.isShopDataFromApi = false;
        this.shop = { ...this.fallbackShop };
      },
    });

    this.backendapiServices.getAllProductList().subscribe({
      next: (response: any) => {
        const apiProducts = response?.data || [];
        this.allApiProducts = Array.isArray(apiProducts) ? apiProducts : [];
        this.populateProductsAndCategories();
      },
      error: () => {
        this.categories = this.buildFallbackCategories();
      },
    });
  }

  private getStoreIdForApi(): string {
    const routeStoreId =
      this.route.snapshot.queryParamMap.get('store_id') ||
      this.route.snapshot.queryParamMap.get('storeId');

    if (routeStoreId) {
      return routeStoreId;
    }

    if (typeof window !== 'undefined') {
      const savedStoreId =
        localStorage.getItem('store_id') ||
        sessionStorage.getItem('store_id') ||
        localStorage.getItem('storeId') ||
        sessionStorage.getItem('storeId');

      if (savedStoreId) {
        return savedStoreId;
      }
    }

    // Fallback only for debugging logs until data binding is finalized.
    return '1';
  }

  private loadCategoryMapAndData(): void {
    this.backendapiServices.Category_list().subscribe({
      next: (response) => {
        const list = response?.data || [];
        this.categoryLookup.clear();
        (Array.isArray(list) ? list : []).forEach((category: any) => {
          const id = this.normalizeId(category?.category_id ?? category?.id);
          const name = category?.category_name || category?.name || id;
          if (id) {
            this.categoryLookup.set(id, name);
          }
        });
        this.loadApiDataInConsole();
      },
      error: () => {
        this.categoryLookup.clear();
        this.loadApiDataInConsole();
      },
    });
  }

  private populateProductsAndCategories(): void {
    const normalizedStoreId = this.normalizeId(this.currentStoreId);
    const storeProducts = this.allApiProducts.filter((product: any) => {
      const variant = product?.im_ProductVariants?.[0];
      const productStoreId = this.resolveStoreId(product, variant);
      return normalizedStoreId ? productStoreId === normalizedStoreId : true;
    });

    if (!storeProducts.length) {
      this.categories = this.buildFallbackCategories();
      return;
    }

    this.allProducts = storeProducts.map((product: any) => {
      const variant = product?.im_ProductVariants?.[0] || {};
      const images = Array.isArray(variant?.im_ProductImages) ? variant.im_ProductImages : [];
      const imageUrl = images.find((img: any) => img?.is_primary === 'T')?.image_url
        || images[0]?.image_url
        || product?.thumbnail_url
        || '/mobile.jpg';
      const categoryKey =
        this.normalizeId(product?.sub_sub_category_id) ||
        this.normalizeId(product?.sub_category_id) ||
        this.normalizeId(product?.category_id) ||
        'uncategorized';

      return {
        id: product?.product_id,
        name: product?.title || 'Untitled Product',
        price: Number(variant?.base_price || 0),
        originalPrice: Number(variant?.base_price || 0) > 0
          ? Math.round(Number(variant?.base_price || 0) * 1.2 * 100) / 100
          : 0,
        rating: Number(product?.rating || 0),
        reviews: Number(product?.review_count || 0),
        sold: Number(product?.sold_count || 0),
        image: imageUrl,
        category: categoryKey,
        inStock: Number(variant?.im_StoreVariantInventory?.[0]?.on_hand_quantity || 0) > 0,
        isApiData: true,
      };
    });

    const categoryCountMap = new Map<string, { name: string; count: number }>();
    this.allProducts.forEach((product: any) => {
      const categoryId = this.normalizeId(product?.category);
      const existing = categoryCountMap.get(categoryId);
      if (existing) {
        existing.count += 1;
      } else {
        categoryCountMap.set(categoryId, {
          name: this.categoryLookup.get(categoryId) || 'Other',
          count: 1,
        });
      }
    });

    this.categories = [
      { id: 'all', name: 'All Products', count: this.allProducts.length, isApiData: true },
      ...Array.from(categoryCountMap.entries()).map(([id, entry]) => ({
        id,
        name: entry.name,
        count: entry.count,
        isApiData: true,
      })),
    ];
    this.selectedCategory = 'all';
  }

  private buildFallbackCategories(): Array<{ id: string; name: string; count: number; isApiData?: boolean }> {
    const map = new Map<string, { name: string; count: number }>();
    this.allProducts.forEach((product: any) => {
      const key = this.normalizeId(product?.category || 'other');
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const derivedName = String(product?.category || 'Other')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (s) => s.toUpperCase());
        map.set(key, { name: derivedName, count: 1 });
      }
    });

    return [
      { id: 'all', name: 'All Products', count: this.allProducts.length, isApiData: false },
      ...Array.from(map.entries()).map(([id, entry]) => ({
        id,
        name: entry.name,
        count: entry.count,
        isApiData: false,
      })),
    ];
  }

  private resolveStoreId(product: any, variant: any): string {
    return this.normalizeId(
      product?.store_id ??
      product?.storeId ??
      variant?.store_id ??
      variant?.storeId ??
      variant?.im_StoreVariantInventory?.[0]?.store_id ??
      variant?.im_StoreVariantInventory?.[0]?.storeId
    );
  }

  private normalizeId(value: any): string {
    return value == null ? '' : String(value);
  }
}
