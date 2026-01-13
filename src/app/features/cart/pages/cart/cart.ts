import { Component } from '@angular/core';
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
export class Cart {
  cartItems = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      image: '/mouse2.jpg',
      quantity: 2,
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      image: '/keyboard.jpg',
      quantity: 1,
      inStock: true
    },
    {
      id: 3,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      image: '/air-pod.jpg',
      quantity: 1,
      inStock: true
    }
  ];

  increaseQuantity(item: any) {
    item.quantity++;
  }

  decreaseQuantity(item: any) {
    if (item.quantity > 1) {
      item.quantity--;
    }
  }

  removeItem(id: number) {
    this.cartItems = this.cartItems.filter(item => item.id !== id);
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
