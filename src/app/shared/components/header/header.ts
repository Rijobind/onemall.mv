import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Signin } from '../../../features/products/models/signin/signin';
import { Signup } from '../../../features/products/models/signup/signup';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';

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
      buttonText: 'SHOP NOW',
    },
    {
      backgroundImage: '/mobile4.jpg',
      leftImage: '/keyboard.jpg',
      rightImage: '/laptop.jpg',
      title: 'SUMMER COLLECTION',
      description: 'New arrivals with exclusive discounts!',
      discount: '50%',
      buttonText: 'EXPLORE NOW',
    },
    {
      backgroundImage: '/mobile2.jpg',
      leftImage: '/air-pod.jpg',
      rightImage: '/camera.jpg',
      title: 'FLASH SALE',
      description: "Limited time offers - Shop before they're gone!",
      discount: '60%',
      buttonText: 'BUY NOW',
    },
    {
      backgroundImage: '/mobile.jpg',
      leftImage: '/ps5.jpg',
      rightImage: '/mouse2.jpg',
      title: 'WEEKEND SPECIAL',
      description: 'Extra savings on selected items!',
      discount: '40%',
      buttonText: 'SHOP NOW',
    },
  ];

  get currentAd() {
    return this.advertisements[this.currentAdIndex];
  }

  categoryTree: any[] = [];
  ProductList: any[] = [];
  activeParent: any = null;
  activeChild: any = null;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private api: BackendapiServices
  ) {}

  ngOnInit() {
    this.startAdRotation();
    this.loadCategory();
    this.loadProductList();
  }

  loadProductList() {
    this.api.getAllProductList().subscribe((res: any) => {
      this.ProductList = res.data || [];
      console.log("Product" ,this.ProductList)
    });
  }

  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      const categories = res.data || [];

      // 1. Get parent categories
      const parents = categories.filter((cat: any) => cat.parent_id === null);

      // 2. Build recursive tree
      this.categoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, categories));

      console.log('Category Tree:', this.categoryTree);
    });
  }

  // Recursive function to build category tree
  buildCategoryTree(parent: any, allCategories: any[]): any {
    const children = allCategories.filter(
      (cat: any) => cat.parent_id === parent.category_id
    );

    return {
      ...parent,
      children: children.map((child: any) => this.buildCategoryTree(child, allCategories)),
    };
  }
  setActiveParent(category: any) {
    this.activeParent = category;
    this.activeChild = null; // Reset active child when parent changes
  }

  setActiveChild(child: any) {
    this.activeChild = child;
  }

  clearActiveParent() {
    this.activeParent = null;
    this.activeChild = null;
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

  selectedCategory = 'All Category';
  isCategoryOpen = false;
  isMobileMenuOpen = false;

  toggleCategoryDropdown() {
    this.isCategoryOpen = !this.isCategoryOpen;
    if (!this.isCategoryOpen) {
      this.activeParent = null;
      this.activeChild = null;
    }
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  selectCategory(category: any) {
    this.selectedCategory = category.category_name;
    this.isCategoryOpen = false;
    this.activeParent = null;
    this.activeChild = null;
    
    // Navigate to product-list page with category info
    this.router.navigate(['/product-list'], {
      queryParams: { 
        categoryId: category.category_id,
        categoryName: category.category_name
      }
    });
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
