import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { MarketplaceShopService } from '../../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../../shared/components/shop-name-link/shop-name-link';
import { ConfirmDialog } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { Signin } from '../../../products/models/signin/signin';
import { Signup } from '../../../products/models/signup/signup';
import { AuthService } from '../../../../core/services/auth.service/auth.service';
import { CurrencyService } from '../../../../core/services/currency.service/currency.service';
import { CartItem, CartService } from '../../../../core/services/cart.service/cart.service';
import { buildProductCommands } from '../../../../core/utils/product-url.util';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, RouterModule, Header, Footer, ShopNameLink, ConfirmDialog, Signin, Signup],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit {
  cartItems: any[] = [];
  quantityOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
  openQtyDropdownForId: string | null = null;
  isSigninModalOpen = false;
  isSignupModalOpen = false;
  isConfirmOpen = false;
  confirmTitle = 'Remove item?';
  confirmMessage = 'Are you sure you want to remove this item from your cart?';
  private pendingRemoveId: string | null = null;

  constructor(
    private router: Router,
    private shopService: MarketplaceShopService,
    private authService: AuthService,
    private currencyService: CurrencyService,
    private cartService: CartService,
    private cdr: ChangeDetectorRef
  ) {}

  increaseQuantity(item: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const key = String(item.cartLineId || item.id);
    this.cartItems = this.cartService.setQuantity(
      key,
      (Number(item.quantity) || 0) + 1
    );
    this.enrichCartItems(this.cartItems);
  }

  decreaseQuantity(item: any, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if ((Number(item.quantity) || 0) > 1) {
      const key = String(item.cartLineId || item.id);
      this.cartItems = this.cartService.setQuantity(
        key,
        (Number(item.quantity) || 0) - 1
      );
      this.enrichCartItems(this.cartItems);
    }
  }

  removeItem(id: string | number, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.pendingRemoveId = String(id);
    this.confirmTitle = 'Remove item?';
    this.confirmMessage = 'Are you sure you want to remove this item from your cart?';
    this.isConfirmOpen = true;
  }

  onConfirmRemove(): void {
    if (this.pendingRemoveId) {
      this.cartItems = this.cartService.removeItem(this.pendingRemoveId);
      this.enrichCartItems(this.cartItems);
    }
    this.closeConfirm();
  }

  closeConfirm(): void {
    this.isConfirmOpen = false;
    this.pendingRemoveId = null;
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
    const key = String(item.cartLineId || item.id);

    if (quantity <= 0) {
      this.removeItem(key);
      return;
    }

    this.cartItems = this.cartService.setQuantity(key, quantity);
    this.enrichCartItems(this.cartItems);
  }

  ngOnInit(): void {
    this.refreshCart();

    if (this.authService.isLoggedIn) {
      this.cartService.loadFromServer().subscribe((items) => {
        this.enrichCartItems(items);
      });
    }
  }

  @HostListener('window:cart-updated')
  onCartUpdated(): void {
    this.refreshCart();
  }

  private refreshCart(): void {
    this.enrichCartItems(this.cartService.getItems());
  }

  private enrichCartItems(items: CartItem[]): void {
    this.cartItems = items;
    this.cdr.markForCheck();
    this.shopService.enrichWithShopNames(items as any[]).subscribe({
      next: (enriched) => {
        this.cartItems = enriched;
        this.cdr.markForCheck();
      },
      error: () => {
        /* items already shown */
      },
    });
  }

  onShopClick(item: any, event?: Event): void {
    this.shopService.navigateToShop(String(item?.store_id || item?.storeId || ''), event);
  }

  onCartItemClick(item: any): void {
    const productId = String(item?.id || '').trim();
    if (!productId && !item?.slug) return;

    const storeId = String(item?.store_id || item?.storeId || '').trim();
    const link = buildProductCommands({
      ...item,
      store_id: storeId || undefined,
    });
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  openSigninModal(): void {
    this.isSignupModalOpen = false;
    this.isSigninModalOpen = true;
  }

  closeSigninModal(): void {
    this.isSigninModalOpen = false;
  }

  openSignupModal(): void {
    this.isSigninModalOpen = false;
    this.isSignupModalOpen = true;
  }

  closeSignupModal(): void {
    this.isSignupModalOpen = false;
  }

  onSigninToSignup(): void {
    this.closeSigninModal();
    this.openSignupModal();
  }

  onSignupToSignin(): void {
    this.closeSignupModal();
    this.openSigninModal();
  }

  onSubmitAsQuote(): void {
    if (this.authService.isLoggedIn || this.authService.hasSavedSession) {
      this.router.navigate(['/quotation']);
      return;
    }
    this.openSigninModal();
  }

  @HostListener('document:click')
  closeAllDropdowns() {
    this.openQtyDropdownForId = null;
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

  get summaryCurrencySymbol(): string {
    const preferred = this.currencyService.selectedOption?.symbol;
    if (preferred) return preferred;
    const firstItemSymbol = this.getItemCurrency(this.cartItems[0]);
    return firstItemSymbol || '$';
  }

  formatSummaryAmount(amount: number): string {
    return `${this.summaryCurrencySymbol}${amount.toFixed(2)}`;
  }

  getItemCurrency(item: any): string {
    return String(item?.store_currency_symbol || '$');
  }
}
