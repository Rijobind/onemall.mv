import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';

@Component({
  selector: 'app-shop-name-link',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="storeId" class="min-w-0">
      <button
        type="button"
        class="max-w-full text-left text-xs font-medium text-green-600 transition truncate hover:text-green-700 hover:underline md:text-sm"
        (click)="onShopClick($event)"
      >
        {{ storeName || 'View shop' }}
      </button>
      <p *ngIf="shopLocation" class="mt-0.5 text-[10px] leading-tight text-gray-500 truncate md:text-xs">
        {{ shopLocation }}
      </p>
    </div>
  `,
})
export class ShopNameLink {
  @Input() storeId = '';
  @Input() storeName = '';
  @Input() shopLocation = '';

  constructor(private shopService: MarketplaceShopService) {}

  onShopClick(event: Event): void {
    this.shopService.navigateToShop(this.storeId, event);
  }
}
