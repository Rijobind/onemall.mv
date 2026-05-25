import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  private readonly maxSwipeOffset = 72;
  private activeSwipeItemId: string | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private swipeStartOffset = 0;
  private isHorizontalSwipe = false;

  cartItems: any[] = [];
  quantityOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
  openQtyDropdownForId: string | null = null;
  swipeOffsets: Record<string, number> = {};

  constructor(private router: Router) {}

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
    delete this.swipeOffsets[normalizedId];
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

  onItemSwipeStart(itemId: string | number, event: TouchEvent): void {
    const touch = event.touches?.[0];
    if (!touch) return;

    const normalizedId = String(itemId);
    this.activeSwipeItemId = normalizedId;
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.swipeStartOffset = this.swipeOffsets[normalizedId] || 0;
    this.isHorizontalSwipe = false;
  }

  onItemSwipeMove(itemId: string | number, event: TouchEvent): void {
    if (this.activeSwipeItemId !== String(itemId)) return;
    const touch = event.touches?.[0];
    if (!touch) return;

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    if (!this.isHorizontalSwipe) {
      if (Math.abs(deltaX) < 8) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      this.isHorizontalSwipe = true;
    }

    event.preventDefault();
    const normalizedId = String(itemId);
    const nextOffset = this.swipeStartOffset + deltaX;
    this.swipeOffsets[normalizedId] = Math.max(0, Math.min(this.maxSwipeOffset, nextOffset));
  }

  onItemSwipeEnd(itemId: string | number): void {
    const normalizedId = String(itemId);
    const offset = this.swipeOffsets[normalizedId] || 0;
    this.swipeOffsets[normalizedId] = offset > this.maxSwipeOffset / 2 ? this.maxSwipeOffset : 0;
    this.activeSwipeItemId = null;
    this.isHorizontalSwipe = false;
  }

  closeSwipe(itemId: string | number): void {
    this.swipeOffsets[String(itemId)] = 0;
  }

  getSwipeOffset(itemId: string | number): number {
    return this.swipeOffsets[String(itemId)] || 0;
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
