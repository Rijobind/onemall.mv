import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Header } from "../../../../shared/components/header/header";
import { Footer } from "../../../../shared/components/footer/footer";

@Component({
  selector: 'app-product-details',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './product-details.html',
  styleUrl: './product-details.css',
})
export class ProductDetails implements OnInit {
  productId: string | null = null;
  selectedImageIndex: number = 0;
  quantity: number = 1;
  selectedColor: string = 'Graphite Black';

  product = {
    id: 1,
    name: '3Dconnexion 3DX-700040 SpaceMouse Pro 3D - Professional 3D Navigation Tool for CAD and Design',
    category: 'Consumer Electronics',
    rating: 4.5,
    reviews: 1738,
    sold: 349,
    price: 64.50,
    originalPrice: 80.40,
    brand: 'Elite Gourmet',
    capacity: '1 Liters',
    material: 'Glass',
    wattage: '1100 watts',
    images: [
      '/shoe3.jpg',
      '/shirt.jpg',
      '/shirt2.jpg',
      '/shirts.jpg',
      '/glass.jpg',
      '/keyboard.jpg'
    ],
    aboutItems: [
      "Here's the quickest way to enjoy your delicious hot tea every single day.",
      "100% BPA-Free premium design meets excellent",
      "No more messy accidents or spills",
      "So easy & convenient that everyone can use it",
      "This powerful 900-1100-Watt kettle has convenient capacity markings on the body lets you accurately",
      "1 year limited warranty and us-based customer support team lets you buy with confidence."
    ],
    description: "Experience professional-grade 3D navigation with the SpaceMouse Pro. Perfect for CAD designers and 3D professionals who need precise control and intuitive navigation in their 3D workspace.",
    productInfo: {
      dimensions: "12 x 8 x 4 inches",
      weight: "2.5 pounds",
      warranty: "1 year limited warranty",
      manufacturer: "3Dconnexion"
    }
  };

  similarProducts = [
    {
      id: 1,
      name: 'Professional Wireless Mouse - Ergonomic Design',
      price: 29.99,
      originalPrice: 39.99,
      rating: 4.5,
      reviews: 1250,
      sold: 850,
      image: '/mouse2.jpg'
    },
    {
      id: 2,
      name: 'Mechanical Gaming Keyboard RGB Backlit',
      price: 79.99,
      originalPrice: 99.99,
      rating: 4.7,
      reviews: 2300,
      sold: 1200,
      image: '/keyboard.jpg'
    },
    {
      id: 3,
      name: 'Premium Laptop Stand Aluminum',
      price: 49.99,
      originalPrice: 69.99,
      rating: 4.3,
      reviews: 890,
      sold: 650,
      image: '/laptop.jpg'
    },
    {
      id: 4,
      name: 'Wireless Bluetooth Earbuds Pro',
      price: 89.99,
      originalPrice: 129.99,
      rating: 4.6,
      reviews: 3450,
      sold: 2800,
      image: '/air-pod.jpg'
    },
    {
      id: 5,
      name: 'High-Performance Gaming Mouse Pad',
      price: 19.99,
      originalPrice: 29.99,
      rating: 4.4,
      reviews: 1560,
      sold: 1100,
      image: '/mouse2.jpg'
    }
  ];

  activeTab: string = 'description';
  colors = ['Graphite Black', 'Silver', 'Rose Gold', 'Space Gray'];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.productId = this.route.snapshot.paramMap.get('id');
  }

  selectImage(index: number) {
    this.selectedImageIndex = index;
  }

  increaseQuantity() {
    this.quantity++;
  }

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  setTab(tab: string) {
    this.activeTab = tab;
  }


  addToCart() {
    // Add to cart logic
    console.log('Added to cart:', this.product);
  }

  buyNow() {
    // Buy now logic
    console.log('Buy now:', this.product);
  }
}
