import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Header } from "../../../shared/components/header/header";
import { Footer } from "../../../shared/components/footer/footer";

@Component({
  selector: 'app-favorite-product',
  imports: [CommonModule, RouterModule, Header, Footer],
  templateUrl: './favorite-product.html',
  styleUrl: './favorite-product.css',
})
export class FavoriteProduct {
  favoriteProducts = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      image: '/mouse2.jpg',
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      image: '/keyboard.jpg',
      inStock: true
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      image: '/laptop.jpg',
      inStock: true
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      image: '/air-pod.jpg',
      inStock: true
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      image: '/mouse2.jpg',
      inStock: true
    },
    {
      id: 6,
      name: 'USB-C Hub Multi-Port Adapter',
      price: 34.99,
      originalPrice: 49.99,
      rating: 4.2,
      reviews: 780,
      image: '/camera.jpg',
      inStock: false
    }
  ];

  removeFromFavorites(id: number) {
    this.favoriteProducts = this.favoriteProducts.filter(product => product.id !== id);
  }

  addToCart(product: any) {
    // Add to cart logic
    console.log('Added to cart:', product);
  }
}
