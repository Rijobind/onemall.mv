import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { Footer } from '../../../shared/components/footer/footer';
import {
  FavoriteProduct as FavoriteProductItem,
  FavoritesService,
} from '../../../core/services/favorites.service/favorites.service';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../shared/components/shop-name-link/shop-name-link';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service/action-feedback.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-favorite-product',
  imports: [CommonModule, RouterModule, Header, Footer, ShopNameLink],
  templateUrl: './favorite-product.html',
  styleUrl: './favorite-product.css',
})
export class FavoriteProduct implements OnInit, OnDestroy {
  private readonly cartStorageKey = 'cart_items';
  private favoritesSub: Subscription | null = null;

  favoriteProducts: FavoriteProductItem[] = [];

  constructor(
    private favoritesService: FavoritesService,
    private router: Router,
    private actionFeedback: ActionFeedbackService,
    private shopService: MarketplaceShopService
  ) {}

  ngOnInit(): void {
    this.refreshFavorites();
    this.favoritesSub = this.favoritesService.favorites$.subscribe(() => {
      this.refreshFavorites();
    });
  }

  private refreshFavorites(): void {
    const items = this.favoritesService.getFavorites();
    this.shopService.enrichWithShopNames(items as any[]).subscribe({
      next: (enriched) => {
        this.favoriteProducts = enriched as FavoriteProductItem[];
      },
      error: () => {
        this.favoriteProducts = items;
      },
    });
  }

  ngOnDestroy(): void {
    if (this.favoritesSub) {
      this.favoritesSub.unsubscribe();
      this.favoritesSub = null;
    }
  }

  removeFromFavorites(id: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.favoritesService.remove(id);
  }

  onProductClick(product: FavoriteProductItem) {
    const storeId = product.store_id ? String(product.store_id) : '';
    if (storeId) {
      localStorage.setItem('store_id', storeId);
    }

    this.router.navigate(['/product-details'], {
      queryParams: {
        productId: product.id,
        store_id: storeId || undefined,
      },
    });
  }

  addToCart(product: FavoriteProductItem, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }

    const productId = String(product?.id ?? '');
    if (!productId) return;

    const existingItems = this.getStoredCartItems();
    const existingIndex = existingItems.findIndex(
      (item: any) => String(item?.id) === productId
    );

    if (existingIndex >= 0) {
      existingItems[existingIndex].quantity =
        (Number(existingItems[existingIndex].quantity) || 0) + 1;
      existingItems[existingIndex].price = Number(product?.price) || 0;
      existingItems[existingIndex].originalPrice = Number(product?.originalPrice) || 0;
      existingItems[existingIndex].image = product?.image || '/mobile.jpg';
      existingItems[existingIndex].name = product?.name || 'Untitled Product';
      existingItems[existingIndex].inStock = product?.inStock !== false;
      existingItems[existingIndex].store_id = product?.store_id || '';
      existingItems[existingIndex].store_name = product?.store_name || '';
      existingItems[existingIndex].shop_location = product?.shop_location || '';
    } else {
      existingItems.push({
        id: productId,
        name: product?.name || 'Untitled Product',
        price: Number(product?.price) || 0,
        originalPrice: Number(product?.originalPrice) || 0,
        image: product?.image || '/mobile.jpg',
        quantity: 1,
        inStock: product?.inStock !== false,
        store_id: product?.store_id || '',
        store_name: product?.store_name || '',
        shop_location: product?.shop_location || '',
      });
    }

    localStorage.setItem(this.cartStorageKey, JSON.stringify(existingItems));
    window.dispatchEvent(new Event('cart-updated'));
    this.actionFeedback.feedback(event, 'cart', { image: product?.image });
  }

  private getStoredCartItems(): any[] {
    const raw = localStorage.getItem(this.cartStorageKey);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
