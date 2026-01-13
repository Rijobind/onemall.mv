import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";
import { ShopProducts } from "../shop-products/shop-products";

@Component({
  selector: 'app-shop-details',
  imports: [CommonModule, RouterModule, Header, Footer, ShopProducts],
  templateUrl: './shop-details.html',
  styleUrl: './shop-details.css',
})
export class ShopDetails implements OnInit {
  selectedCategory: string = 'all';
  sortBy: string = 'newest';

  shop = {
    id: 1,
    name: 'Premium Electronics',
    description: 'Your trusted source for premium electronics and tech accessories. We offer the latest gadgets, accessories, and tech solutions for your everyday needs.',
    logo: '/shirt.jpg',
    coverImage: '/mobile3.jpg',
    rating: 4.8,
    reviews: 2540,
    responseRate: 98,
    responseTime: 'Within 1 hour',
    itemsSold: 15200,
    followers: 8500,
    joinedDate: 'January 2020',
    location: 'New York, USA',
    verified: true
  };

  categories = [
    { id: 'all', name: 'All Products', count: 45 },
    { id: 'electronics', name: 'Electronics', count: 18 },
    { id: 'accessories', name: 'Accessories', count: 12 },
    { id: 'computers', name: 'Computers & Laptops', count: 8 },
    { id: 'mobile', name: 'Mobile & Tablets', count: 7 }
  ];

  allProducts = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 6,
      name: 'USB-C Hub Multi-Port Adapter',
      price: 34.99,
      originalPrice: 49.99,
      rating: 4.2,
      reviews: 780,
      sold: 520,
      image: '/camera.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg',
      category: 'accessories',
      inStock: true
    },
    {
      id: 7,
      name: 'Smart Watch Fitness Tracker',
      price: 149.99,
      originalPrice: 199.99,
      rating: 4.5,
      reviews: 2100,
      sold: 1500,
      image: '/mobile.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 8,
      name: 'Portable External SSD 1TB',
      price: 99.99,
      originalPrice: 149.99,
      rating: 4.8,
      reviews: 1890,
      sold: 1350,
      image: '/ps5.jpg',
      category: 'computers',
      inStock: true
    },
    {
      id: 9,
      name: 'Wireless Charging Pad Fast',
      price: 24.99,
      originalPrice: 39.99,
      rating: 4.3,
      reviews: 1120,
      sold: 890,
      image: '/mobile2.jpg',
      category: 'mobile',
      inStock: true
    },
    {
      id: 10,
      name: 'HD Webcam 1080p with Microphone',
      price: 59.99,
      originalPrice: 79.99,
      rating: 4.6,
      reviews: 2430,
      sold: 1800,
      image: '/camera.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 11,
      name: 'Gaming Headset with Surround Sound',
      price: 89.99,
      originalPrice: 119.99,
      rating: 4.7,
      reviews: 3200,
      sold: 2500,
      image: '/air-pod.jpg',
      category: 'electronics',
      inStock: true
    },
    {
      id: 12,
      name: 'Laptop Cooling Pad with LED',
      price: 39.99,
      originalPrice: 59.99,
      rating: 4.2,
      reviews: 980,
      sold: 720,
      image: '/laptop.jpg',
      category: 'computers',
      inStock: true
    }
  ];

  get filteredProducts() {
    if (this.selectedCategory === 'all') {
      return this.allProducts;
    }
    return this.allProducts.filter(product => product.category === this.selectedCategory);
  }

  get sortedProducts() {
    const products = [...this.filteredProducts];
    switch (this.sortBy) {
      case 'price-low':
        return products.sort((a, b) => a.price - b.price);
      case 'price-high':
        return products.sort((a, b) => b.price - a.price);
      case 'rating':
        return products.sort((a, b) => b.rating - a.rating);
      case 'newest':
      default:
        return products;
    }
  }

  ngOnInit() {
    // Initialize component
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
  }

  onSortChange(sortValue: string) {
    this.sortBy = sortValue;
  }
}
