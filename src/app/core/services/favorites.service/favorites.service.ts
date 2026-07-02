import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  inStock: boolean;
  store_id?: string;
  store_name?: string;
  shop_location?: string;
  rating?: number;
  reviews?: number;
  brand?: string;
  delivery?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly storageKey = 'favorite_products';
  private readonly favoritesSubject = new BehaviorSubject<FavoriteProduct[]>(
    this.loadFromStorage()
  );

  readonly favorites$ = this.favoritesSubject.asObservable();

  getFavorites(): FavoriteProduct[] {
    return this.favoritesSubject.getValue();
  }

  getCount(): number {
    return this.getFavorites().length;
  }

  isFavorite(id: string | number | null | undefined): boolean {
    const normalizedId = String(id ?? '');
    if (!normalizedId) return false;
    return this.getFavorites().some((item) => String(item.id) === normalizedId);
  }

  toggle(product: Partial<FavoriteProduct> & { id: string | number }): boolean {
    if (this.isFavorite(product.id)) {
      this.remove(product.id);
      return false;
    }
    this.add(product);
    return true;
  }

  add(product: Partial<FavoriteProduct> & { id: string | number }): void {
    const normalizedId = String(product.id ?? '');
    if (!normalizedId || this.isFavorite(normalizedId)) return;

    const newItem: FavoriteProduct = {
      id: normalizedId,
      name: product.name || 'Untitled Product',
      price: Number(product.price) || 0,
      originalPrice: Number(product.originalPrice) || 0,
      image: product.image || '/mobile.jpg',
      inStock: product.inStock !== false,
      store_id: product.store_id ? String(product.store_id) : undefined,
      store_name: product.store_name ? String(product.store_name) : undefined,
      shop_location: product.shop_location ? String(product.shop_location) : undefined,
      rating: product.rating,
      reviews: product.reviews,
      brand: product.brand,
      delivery: product.delivery,
    };

    this.persist([...this.getFavorites(), newItem]);
  }

  remove(id: string | number): void {
    const normalizedId = String(id ?? '');
    if (!normalizedId) return;

    const updated = this.getFavorites().filter(
      (item) => String(item.id) !== normalizedId
    );
    this.persist(updated);
  }

  fromListProduct(product: any): Partial<FavoriteProduct> & { id: string | number } {
    return {
      id: product?.id,
      name: product?.name || 'Untitled Product',
      price: Number(product?.price) || 0,
      originalPrice: Number(product?.originalPrice) || 0,
      image: product?.image || '/mobile.jpg',
      inStock: product?.inStock !== false,
      store_id: product?.store_id ? String(product.store_id) : undefined,
      store_name: product?.store_name ? String(product.store_name) : undefined,
      shop_location: product?.shop_location ? String(product.shop_location) : undefined,
      rating: product?.rating,
      reviews: product?.reviews,
      brand: product?.brand,
      delivery: product?.delivery,
    };
  }

  fromDetailsProduct(
    product: any,
    image?: string,
    storeId?: string
  ): Partial<FavoriteProduct> & { id: string | number } {
    return {
      id: product?.id,
      name: product?.name || 'Untitled Product',
      price: Number(product?.price) || 0,
      originalPrice: Number(product?.originalPrice) || 0,
      image: image || product?.images?.[0] || '/mobile.jpg',
      inStock: product?.inStock !== false,
      store_id: storeId ? String(storeId) : undefined,
      rating: product?.rating,
      reviews: product?.reviews,
      brand: product?.brand,
    };
  }

  private persist(items: FavoriteProduct[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.favoritesSubject.next(items);
    window.dispatchEvent(new Event('favorites-updated'));
  }

  private loadFromStorage(): FavoriteProduct[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item?.id != null)
        .map((item) => ({
          id: String(item.id),
          name: item.name || 'Untitled Product',
          price: Number(item.price) || 0,
          originalPrice: Number(item.originalPrice) || 0,
          image: item.image || '/mobile.jpg',
          inStock: item.inStock !== false,
          store_id: item.store_id ? String(item.store_id) : undefined,
          rating: item.rating,
          reviews: item.reviews,
          brand: item.brand,
          delivery: item.delivery,
        }));
    } catch {
      return [];
    }
  }
}
