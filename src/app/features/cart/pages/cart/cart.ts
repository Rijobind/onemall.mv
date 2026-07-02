import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, RouterModule, Header, Footer, ShopNameLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit {
  private readonly cartStorageKey = 'cart_items';

  cartItems: any[] = [];
  quantityOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
  openQtyDropdownForId: string | null = null;

  constructor(
    private router: Router,
    private shopService: MarketplaceShopService
  ) {}

  increaseQuantity(item: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    item.quantity++;
    this.persistCartItems();
  }

  decreaseQuantity(item: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (item.quantity > 1) {
      item.quantity--;
      this.persistCartItems();
    }
  }

  removeItem(id: string | number, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const normalizedId = String(id);
    this.cartItems = this.cartItems.filter(item => String(item.id) !== normalizedId);
    this.persistCartItems();
  }

  toggleQuantityDropdown(itemId: string | number, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const normalizedId = String(itemId);
    this.openQtyDropdownForId =
      this.openQtyDropdownForId === normalizedId ? null : normalizedId;
  }

  isQuantityDropdownOpen(itemId: string | number): boolean {
    return this.openQtyDropdownForId === String(itemId);
  }

  setQuantity(item: any, quantity: number, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }

    this.openQtyDropdownForId = null;

    if (quantity <= 0) {
      this.removeItem(item.id);
      return;
    }

    item.quantity = quantity;
    this.persistCartItems();
  }

  ngOnInit(): void {
    const savedItems = localStorage.getItem(this.cartStorageKey);
    if (!savedItems) return;

    try {
      const parsedItems = JSON.parse(savedItems);
      if (Array.isArray(parsedItems)) {
        this.shopService.enrichWithShopNames(parsedItems).subscribe({
          next: (enriched) => {
            this.cartItems = enriched;
          },
          error: () => {
            this.cartItems = parsedItems;
          },
        });
      }
    } catch {
      this.cartItems = [];
    }
  }

  onShopClick(item: any, event?: Event): void {
    this.shopService.navigateToShop(String(item?.store_id || item?.storeId || ''), event);
  }

  onCartItemClick(item: any): void {
    const productId = String(item?.id || '').trim();
    if (!productId) return;

    const storeId = String(item?.store_id || item?.storeId || '').trim();
    this.router.navigate(['/product-details'], {
      queryParams: {
        productId,
        store_id: storeId || undefined,
      },
    });
  }

  prepareQuotation(): void {
    this.persistCartItems();
  }

  @HostListener('document:click')
  closeAllDropdowns() {
    this.openQtyDropdownForId = null;
  }

  private persistCartItems(): void {
    localStorage.setItem(this.cartStorageKey, JSON.stringify(this.cartItems));
    window.dispatchEvent(new Event('cart-updated'));
  }

  get subtotal() {
    return this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get shipping() {
    return this.subtotal > 50 ? 0 : 5.99;
  }

  get tax() {
    return this.subtotal * 0.08;
  }

  get total() {
    return this.subtotal + this.shipping + this.tax;
  }
}
