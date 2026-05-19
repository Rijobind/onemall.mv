import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, RouterModule, Header, Footer],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit {
  private readonly cartStorageKey = 'cart_items';

  cartItems: any[] = [];
  quantityOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
  openQtyDropdownForId: string | null = null;

  increaseQuantity(item: any) {
    item.quantity++;
    this.persistCartItems();
  }

  decreaseQuantity(item: any) {
    if (item.quantity > 1) {
      item.quantity--;
      this.persistCartItems();
    }
  }

  removeItem(id: string | number) {
    this.cartItems = this.cartItems.filter(item => String(item.id) !== String(id));
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
        this.cartItems = parsedItems;
      }
    } catch {
      this.cartItems = [];
    }
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
