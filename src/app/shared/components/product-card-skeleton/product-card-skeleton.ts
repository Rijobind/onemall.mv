import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ProductCardSkeletonLayout = 'grid' | 'list' | 'compact';

@Component({
  selector: 'app-product-card-skeleton',
  imports: [CommonModule],
  templateUrl: './product-card-skeleton.html',
  styleUrl: './product-card-skeleton.css',
})
export class ProductCardSkeleton {
  /** grid = catalog cards, list = desktop row, compact = home mobile strip */
  @Input() layout: ProductCardSkeletonLayout = 'grid';
}
