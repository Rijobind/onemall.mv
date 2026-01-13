import { Component, Input, Output, EventEmitter, OnInit, OnChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-shop-products',
  imports: [CommonModule, RouterModule],
  templateUrl: './shop-products.html',
  styleUrl: './shop-products.css',
})
export class ShopProducts implements OnInit, OnChanges {
  @Input() products: any[] = [];
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showSort: boolean = true;
  @Input() sortBy: string = 'newest';
  @Output() sortChange = new EventEmitter<string>();

  internalSortBy: string = 'newest';
  isSortOpen: boolean = false;

  sortOptions = [
    { label: 'Newest', value: 'newest' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Highest Rated', value: 'rating' }
  ];

  get selectedSortLabel() {
    const option = this.sortOptions.find(opt => opt.value === this.internalSortBy);
    return option ? option.label : 'Newest';
  }

  ngOnInit() {
    this.internalSortBy = this.sortBy;
  }

  ngOnChanges() {
    this.internalSortBy = this.sortBy;
  }

  toggleSortDropdown() {
    this.isSortOpen = !this.isSortOpen;
  }

  selectSort(sortValue: string) {
    this.internalSortBy = sortValue;
    this.isSortOpen = false;
    this.sortChange.emit(sortValue);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.sort-dropdown')) {
      this.isSortOpen = false;
    }
  }

  get sortedProducts() {
    const products = [...this.products];
    switch (this.internalSortBy) {
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
}
