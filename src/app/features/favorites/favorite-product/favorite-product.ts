import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { Footer } from '../../../shared/components/footer/footer';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import {
  FavoriteProduct as FavoriteProductItem,
  FavoritesService,
} from '../../../core/services/favorites.service/favorites.service';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../shared/components/shop-name-link/shop-name-link';
import { AuthService } from '../../../core/services/auth.service/auth.service';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';
import { RegionService } from '../../../core/services/region.service/region.service';
import { CurrencyService } from '../../../core/services/currency.service/currency.service';
import { CartModel, CartModelMode } from '../../products/models/cart-model/cart-model';
import { extractApiData, isApiSuccess } from '../../../core/utils/api-response.util';
import { buildProductCommands } from '../../../core/utils/product-url.util';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-favorite-product',
  imports: [CommonModule, RouterModule, Header, Footer, ShopNameLink, ConfirmDialog, CartModel],
  templateUrl: './favorite-product.html',
  styleUrl: './favorite-product.css',
})
export class FavoriteProduct implements OnInit, OnDestroy {
  private favoritesSub: Subscription | null = null;

  favoriteProducts: FavoriteProductItem[] = [];
  isLoading = false;
  isConfirmOpen = false;
  confirmTitle = 'Remove from wishlist?';
  confirmMessage = 'Are you sure you want to remove this product from your wishlist?';
  private pendingRemoveId: string | null = null;

  isCartModalOpen = false;
  cartModalMode: CartModelMode = 'add';
  cartModalApiProduct: any = null;
  cartModalStoreId = '';
  private cartModalLoadingId: string | null = null;

  constructor(
    private favoritesService: FavoritesService,
    private router: Router,
    private shopService: MarketplaceShopService,
    private authService: AuthService,
    private api: BackendapiServices,
    private regionService: RegionService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.isLoggedIn && !this.authService.hasSavedSession) {
      this.favoritesService.requestSignIn();
      this.router.navigate(['/'], { queryParams: { login: '1' } });
      return;
    }

    this.refreshFavorites();
    this.favoritesSub = this.favoritesService.favorites$.subscribe(() => {
      this.refreshFavorites();
    });

    this.isLoading = true;
    this.cdr.markForCheck();
    this.favoritesService.loadFromServer().subscribe({
      next: () => {
        this.isLoading = false;
        this.refreshFavorites();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private refreshFavorites(): void {
    const items = this.favoritesService.getFavorites();
    this.favoriteProducts = items;
    this.cdr.markForCheck();
    this.shopService.enrichWithShopNames(items as any[]).subscribe({
      next: (enriched) => {
        this.favoriteProducts = enriched as FavoriteProductItem[];
        this.cdr.markForCheck();
      },
      error: () => {
        /* items already shown */
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
    this.pendingRemoveId = id;
    this.confirmTitle = 'Remove from wishlist?';
    this.confirmMessage = 'Are you sure you want to remove this product from your wishlist?';
    this.isConfirmOpen = true;
  }

  onConfirmRemove(): void {
    if (this.pendingRemoveId) {
      this.favoritesService.remove(this.pendingRemoveId);
    }
    this.closeConfirm();
  }

  closeConfirm(): void {
    this.isConfirmOpen = false;
    this.pendingRemoveId = null;
  }

  onProductClick(product: FavoriteProductItem) {
    const storeId = product.store_id ? String(product.store_id) : '';
    if (storeId) {
      localStorage.setItem('store_id', storeId);
    }

    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  addToCart(product: FavoriteProductItem, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }

    const productId = String(product?.id ?? '').trim();
    if (!productId || this.cartModalLoadingId === productId) return;

    this.cartModalLoadingId = productId;
    this.cdr.markForCheck();

    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams()
    );

    this.api.getMarketplaceProductById(productId, params).subscribe({
      next: (res: any) => {
        this.cartModalLoadingId = null;
        const apiProduct = this.extractSingleProduct(res);
        this.openCartModal(product, apiProduct);
      },
      error: () => {
        this.cartModalLoadingId = null;
        this.openCartModal(product, null);
      },
    });
  }

  closeCartModal(): void {
    this.isCartModalOpen = false;
  }

  onCartModalAdded(): void {
    this.isCartModalOpen = false;
  }

  private openCartModal(product: FavoriteProductItem, apiProduct: any | null): void {
    const productId = String(product?.id ?? '').trim();
    if (!productId) return;

    if (apiProduct) {
      this.cartModalApiProduct = {
        ...apiProduct,
        store_currency_code:
          product?.store_currency_code || apiProduct?.store_currency_code,
        store_currency_symbol:
          product?.store_currency_symbol || apiProduct?.store_currency_symbol,
        store_name: product?.store_name || apiProduct?.store_name,
        shop_location: product?.shop_location || apiProduct?.shop_location,
      };
    } else {
      // Fallback when product fetch fails — qty can still be chosen.
      this.cartModalApiProduct = {
        product_id: productId,
        title: product?.name || 'Untitled Product',
        thumbnail_url: product?.image || '/mobile.jpg',
        store_id: product?.store_id,
        store_name: product?.store_name,
        shop_location: product?.shop_location,
        store_currency_code: product?.store_currency_code,
        store_currency_symbol: product?.store_currency_symbol,
        im_ProductVariants: [
          {
            base_price: Number(product?.price) || 0,
            im_ProductImages: [{ image_url: product?.image || '/mobile.jpg', is_primary: 'T' }],
            im_VariantAttributes: [],
            im_StoreVariantInventory: [
              { on_hand_quantity: product?.inStock === false ? 0 : 1 },
            ],
          },
        ],
      };
    }

    this.cartModalStoreId = String(product?.store_id || '').trim();
    this.cartModalMode = 'add';
    this.isCartModalOpen = true;
    this.cdr.markForCheck();
  }

  private extractSingleProduct(res: any): any | null {
    if (!isApiSuccess(res) && res?.success !== true && res?.Success !== true) {
      const data = extractApiData(res);
      if (data && !Array.isArray(data) && (data.product_id || data.slug)) {
        return data;
      }
      return null;
    }
    const data = extractApiData(res);
    if (data && !Array.isArray(data)) return data;
    if (Array.isArray(data) && data.length) return data[0];
    return null;
  }
}
