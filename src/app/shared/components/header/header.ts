import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Signin } from '../../../features/products/models/signin/signin';
import { Signup } from '../../../features/products/models/signup/signup';

@Component({
  selector: 'app-header',
  imports: [CommonModule, Signin, Signup],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit, OnDestroy {
  cartCount = 0;
  wishlistCount = 3;
  notificationCount = 4;
  isSigninModalOpen = false;
  isSignupModalOpen = false;

  currentAdIndex = 0;
  private adInterval: any;

  advertisements = [
    {
      backgroundImage: '/mobile3.jpg',
      leftImage: '/mobile2.jpg',
      rightImage: '/mobile.jpg',
      title: 'CYBER MONDAY SALE',
      description: "Don't miss out on amazing deals!",
      discount: '75%',
      buttonText: 'SHOP NOW'
    },
    {
      backgroundImage: '/mobile4.jpg',
      leftImage: '/keyboard.jpg',
      rightImage: '/laptop.jpg',
      title: 'SUMMER COLLECTION',
      description: 'New arrivals with exclusive discounts!',
      discount: '50%',
      buttonText: 'EXPLORE NOW'
    },
    {
      backgroundImage: '/mobile2.jpg',
      leftImage: '/air-pod.jpg',
      rightImage: '/camera.jpg',
      title: 'FLASH SALE',
      description: 'Limited time offers - Shop before they\'re gone!',
      discount: '60%',
      buttonText: 'BUY NOW'
    },
    {
      backgroundImage: '/mobile.jpg',
      leftImage: '/ps5.jpg',
      rightImage: '/mouse2.jpg',
      title: 'WEEKEND SPECIAL',
      description: 'Extra savings on selected items!',
      discount: '40%',
      buttonText: 'SHOP NOW'
    }
  ];

  get currentAd() {
    return this.advertisements[this.currentAdIndex];
  }

  constructor(private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.startAdRotation();
  }

  startAdRotation() {
    if (this.adInterval) clearInterval(this.adInterval);
    this.adInterval = setInterval(() => {
      this.currentAdIndex = (this.currentAdIndex + 1) % this.advertisements.length;
      this.cdr.markForCheck();
    }, 2000);
  }

  ngOnDestroy() {
    if (this.adInterval) {
      clearInterval(this.adInterval);
      this.adInterval = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown')) {
      this.isCategoryOpen = false;
    }
    if (!target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
      this.isMobileMenuOpen = false;
    }
  }

  shopMenu = [
    { label: 'Shop Grid', link: '#' },
    { label: 'Shop List', link: '#' },
    { label: 'Shop Left Sidebar', link: '#' },
    { label: 'Shop Right Sidebar', link: '#' },
    { label: 'Shop Full Width', link: '#' },
  ];

  productMenu = [
    { label: 'Product Details', link: '#' },
    { label: 'Product Gallery', link: '#' },
    { label: 'Product Compare', link: '#' },
    { label: 'Product Cart', link: '#' },
    { label: 'Product Checkout', link: '#' },
  ];

  pageMenu = [
    { label: 'About Us', link: '#' },
    { label: 'Contact Us', link: '#' },
    { label: 'FAQ', link: '#' },
    { label: '404 Page', link: '#' },
    { label: 'Coming Soon', link: '#' },
  ];

  categories = [
    { label: 'All Category', value: 'all' },
    { label: 'Electronics', value: 'electronics' },
    { label: 'Fashion', value: 'fashion' },
    { label: 'Home & Living', value: 'home-living' },
    { label: 'Sports & Outdoors', value: 'sports' },
    { label: 'Beauty & Health', value: 'beauty' },
    { label: 'Books & Media', value: 'books' },
    { label: 'Toys & Games', value: 'toys' },
  ];

  selectedCategory = 'All Category';
  isCategoryOpen = false;
  isMobileMenuOpen = false;

  toggleCategoryDropdown() {
    this.isCategoryOpen = !this.isCategoryOpen;
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  selectCategory(category: { label: string; value: string }) {
    this.selectedCategory = category.label;
    this.isCategoryOpen = false;
  }

  onHome() {
    this.router.navigate(['']);
  }

  onNotifications() {
    this.router.navigate(['/notification-item']);
  }

  onFavorites() {
    this.router.navigate(['/favorite-products']);
  }

  onCart() {
    this.router.navigate(['/cart']);
  }

  onAboutUs() {
    this.router.navigate(['/about-us']);
  }

  onContact() {
    this.router.navigate(['/contact']);
  }

  openSigninModal() {
    this.isSigninModalOpen = true;
  }

  closeSigninModal() {
    this.isSigninModalOpen = false;
  }

  openSignupModal() {
    this.isSignupModalOpen = true;
  }

  closeSignupModal() {
    this.isSignupModalOpen = false;
  }

  onSigninToSignup() {
    this.closeSigninModal();
    this.openSignupModal();
  }

  onSignupToSignin() {
    this.closeSignupModal();
    this.openSigninModal();
  }
}
