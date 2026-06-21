import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { Header } from '../../../../shared/components/header/header';

interface CategoryItem {
  id: string;
  name: string;
  image: string;
  parentId?: string | null;
  hot?: boolean;
}

@Component({
  selector: 'app-categories',
  imports: [CommonModule, Header],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories implements OnInit {
  private readonly fallbackImages = [
    '/Categories1.jpg',
    '/Categories2.jpg',
    '/Categories3.jpg',
    '/Categories4.jpg',
    '/Categories5.jpg',
    '/Categories6.jpg',
    '/Categories7.jpg',
    '/Categories8.jpg',
    '/Categories9.jpg',
    '/Categories10.jpg',
    '/Categories11.jpg',
    '/Categories12.jpg',
  ];

  allCategories: CategoryItem[] = [];
  featuredCategories: CategoryItem[] = [];
  shopCategories: CategoryItem[] = [];
  selectedFeaturedCategoryId = '';
  isLoading = true;

  constructor(
    private router: Router,
    private api: BackendapiServices
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.isLoading = true;
    this.api.getAllCategoryList().subscribe({
      next: (res: any) => {
        const apiCategories = Array.isArray(res?.data) ? res.data : [];
        this.allCategories = apiCategories.map((item: any, index: number) =>
          this.mapCategory(item, index)
        );

        this.featuredCategories = this.allCategories.filter((cat) => !cat.parentId);

        if (this.featuredCategories.length > 0) {
          this.selectedFeaturedCategoryId = this.featuredCategories[0].id;
          this.setShopCategories(this.selectedFeaturedCategoryId);
        } else {
          this.selectedFeaturedCategoryId = '';
          this.shopCategories = [];
        }
        this.isLoading = false;
      },
      error: () => {
        this.allCategories = [];
        this.featuredCategories = [];
        this.shopCategories = [];
        this.selectedFeaturedCategoryId = '';
        this.isLoading = false;
      },
    });
  }

  private mapCategory(item: any, index: number): CategoryItem {
    const imageCandidate = this.getFirstValidImage(item);
    const categoryId = this.normalizeId(item?.category_id) || `category-${index}`;
    const parentId = this.normalizeId(item?.parent_id);

    return {
      id: categoryId,
      name: String(item?.category_name || 'Category'),
      parentId,
      image: imageCandidate || this.fallbackImages[index % this.fallbackImages.length] || '/mobile.jpg',
      hot: this.toBoolean(item?.is_hot) || this.toBoolean(item?.hot),
    };
  }

  private getFirstValidImage(item: any): string {
    const candidates = [
      item?.image,
      item?.image_url,
      item?.category_image,
      item?.thumbnail,
      item?.thumbnail_url,
      item?.icon,
      item?.icon_url,
    ];
    const first = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return first ? String(first) : '';
  }

  private normalizeId(value: any): string | null {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    if (!normalized || normalized.toLowerCase() === 'null') return null;
    return normalized;
  }

  private toBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes';
  }

  private setShopCategories(parentId: string): void {
    const directChildren = this.allCategories.filter((cat) => cat.parentId === parentId);
    this.shopCategories = directChildren.length > 0 ? directChildren : this.allCategories;
  }

  onSelectFeaturedCategory(category: CategoryItem): void {
    this.selectedFeaturedCategoryId = category.id;
    this.setShopCategories(category.id);
  }

  onSelectCategory(category: CategoryItem): void {
    this.router.navigate(['/product-list'], {
      queryParams: {
        categoryId: category.id,
        categoryName: category.name,
      },
    });
  }

  trackByCategoryName(_: number, category: CategoryItem): string {
    return category.id;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.src = '/mobile.jpg';
  }

}
