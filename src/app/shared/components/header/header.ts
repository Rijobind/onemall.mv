import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  cartCount = 0;
  wishlistCount = 3;
  notificationCount = 4;

  constructor(private router : Router){}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.category-dropdown')) {
      this.isCategoryOpen = false;
    }
  }

  homeMenu = [
    { label: 'Home 1', link: '#' },
    { label: 'Home 2', link: '#' },
    { label: 'Home 3', link: '#' },
    { label: 'Home 4', link: '#' },
  ];

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

  blogMenu = [
    { label: 'Blog Grid', link: '#' },
    { label: 'Blog List', link: '#' },
    { label: 'Blog Single', link: '#' },
    { label: 'Blog Left Sidebar', link: '#' },
    { label: 'Blog Right Sidebar', link: '#' },
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

  toggleCategoryDropdown() {
    this.isCategoryOpen = !this.isCategoryOpen;
  }

  selectCategory(category: { label: string; value: string }) {
    this.selectedCategory = category.label;
    this.isCategoryOpen = false;
  }

  onHome(){
    this.router.navigate([''])
  }
}
