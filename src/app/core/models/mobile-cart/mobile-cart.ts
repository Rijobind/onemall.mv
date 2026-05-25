import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-mobile-cart',
  imports: [CommonModule],
  templateUrl: './mobile-cart.html',
  styleUrl: './mobile-cart.css',
})
export class MobileCart {
  @Input() isOpen: boolean = false;
  @Input() item: {
    name: string;
    image: string;
    quantity: number;
    price: number;
    shipping: number;
  } | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() seeCart = new EventEmitter<void>();

  close(): void {
    this.closeModal.emit();
  }

  onSeeCart(): void {
    this.seeCart.emit();
  }

  get subtotal(): number {
    const qty = Number(this.item?.quantity || 0);
    const price = Number(this.item?.price || 0);
    const shipping = Number(this.item?.shipping || 0);
    return qty * price + shipping;
  }
}
