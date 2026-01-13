import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
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

  ngOnInit() {
    this.internalSortBy = this.sortBy;
  }

  ngOnChanges() {
    this.internalSortBy = this.sortBy;
  }

  onSortChange(sortValue: string) {
    this.internalSortBy = sortValue;
    this.sortChange.emit(sortValue);
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
