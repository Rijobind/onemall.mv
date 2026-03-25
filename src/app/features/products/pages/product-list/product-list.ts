import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, Header, Footer],
  templateUrl: './product-list.html',
  styleUrl: './product-list.css',
})
export class ProductList implements OnInit {
  categoryTree: any[] = [];
  allCategories: any[] = [];
  activeChildMap: Map<string, any> = new Map();
  products: any[] = [];
  filteredProducts: any[] = [];
  selectedCategory: any = null;
  categoryBreadcrumb: any[] = []; // [parent, child, grandchild]
  displayedCategoryTree: any[] = []; // Categories to show in sidebar
  sortBy: string = 'featured';
  isSortOpen: boolean = false;
  isLoading: boolean = true;

  sortOptions = [
    { label: 'Featured', value: 'featured' },
    { label: 'Price: Low to High', value: 'price-low' },
    { label: 'Price: High to Low', value: 'price-high' },
    { label: 'Highest Rated', value: 'rating' },
    { label: 'Newest Arrivals', value: 'newest' },
  ];

  constructor(
    private api: BackendapiServices,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadCategory();
    this.loadProducts();
  }

  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      this.allCategories = res.data || [];
      const parents = this.allCategories.filter((cat: any) => cat.parent_id === null);
      this.categoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, this.allCategories));
      this.displayedCategoryTree = this.categoryTree; // Initialize with all categories
      console.log('Product List Category Tree:', this.categoryTree);
      
      // Check route params after categories are loaded
      const categoryId = this.route.snapshot.queryParams['categoryId'];
      if (categoryId) {
        this.selectCategoryById(categoryId);
      }
    });
  }

  loadProducts() {
    this.api.getAllProductList().subscribe(
      (res: any) => {
        const apiProducts = res.data || [];
        
        // Transform API product data to match template structure
        this.products = apiProducts.map((product: any) => {
          const variant = product.im_ProductVariants?.[0];
          const images = variant?.im_ProductImages || [];
          const primaryImage = images.find((img: any) => img.is_primary === 'T') || images[0] || {};
          const inventory = variant?.im_StoreVariantInventory?.[0];
          const onHandQty = inventory?.on_hand_quantity || 0;
          
          return {
            id: product.product_id,
            name: product.title || 'Untitled Product',
            price: variant?.base_price || 0,
            originalPrice: variant?.base_price && variant.base_price > 0 
              ? Math.round(variant.base_price * 1.2 * 100) / 100 
              : 0,
            rating: 4.5, // Default rating - update when API provides
            reviews: Math.floor(Math.random() * 5000) + 100, // Mock reviews - update when API provides
            image: primaryImage?.image_url || product.thumbnail_url || '/mobile.jpg',
            category_id: product.category_id,
            sub_category_id: product.sub_category_id,
            sub_sub_category_id: product.sub_sub_category_id,
            description: product.description,
            brand: product.brand,
            inStock: onHandQty > 0,
            delivery: 'FREE delivery',
            offer: 'Up to 5% back',
            stock: onHandQty > 0 && onHandQty < 10 
              ? `Only ${onHandQty} left in stock` 
              : null,
          };
        });
        
        this.filteredProducts = [...this.products];
        this.applySort();
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading products:', error);
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
      }
    );
  }

  buildCategoryTree(parent: any, allCategories: any[]): any {
    const children = allCategories.filter(
      (cat: any) => cat.parent_id === parent.category_id
    );
    return {
      ...parent,
      children: children.map((child: any) => this.buildCategoryTree(child, allCategories)),
    };
  }

  setActiveChild(parentId: string, child: any) {
    this.activeChildMap.set(parentId, child);
  }

  clearActiveChild(parentId: string) {
    this.activeChildMap.delete(parentId);
  }

  getActiveChild(parentId: string): any {
    return this.activeChildMap.get(parentId);
  }

  selectCategoryById(categoryId: string) {
    // Find category in the flat list first
    const category = this.allCategories.find((cat: any) => cat.category_id === categoryId);
    if (category) {
      // Rebuild the category with children from tree
      const categoryWithChildren = this.findCategoryById(categoryId, this.categoryTree);
      if (categoryWithChildren) {
        this.onCategoryClick(categoryWithChildren);
      } else {
        // If not found in tree, use the flat category
        this.onCategoryClick(category);
      }
    }
  }

  findCategoryById(categoryId: string, tree: any[]): any {
    for (const cat of tree) {
      if (cat.category_id === categoryId) {
        return cat;
      }
      if (cat.children && cat.children.length > 0) {
        const found = this.findCategoryById(categoryId, cat.children);
        if (found) return found;
      }
    }
    return null;
  }

  buildCategoryBreadcrumb(category: any): any[] {
    if (!category) return [];
    
    const breadcrumb: any[] = [];
    
    // Recursively find all parents
    const findParents = (cat: any): any[] => {
      if (!cat || !cat.parent_id) {
        return [];
      }
      
      const parent = this.allCategories.find((c: any) => c.category_id === cat.parent_id);
      if (parent) {
        return [...findParents(parent), parent];
      }
      return [];
    };
    
    // Build breadcrumb: [parent, child, grandchild]
    const parents = findParents(category);
    breadcrumb.push(...parents);
    breadcrumb.push(category);
    
    return breadcrumb;
  }

  onCategoryClick(category: any) {
    this.selectedCategory = category;
    this.categoryBreadcrumb = this.buildCategoryBreadcrumb(category);
    
    // Find the parent category and set displayed category tree
    this.updateDisplayedCategoryTree(category);
    
    // Get all category IDs including children for filtering
    const categoryIds = this.getAllCategoryIds(category);
    
    // Filter products by category
    this.filteredProducts = this.products.filter((product: any) => {
      return (
        categoryIds.includes(product.category_id) ||
        categoryIds.includes(product.sub_category_id) ||
        categoryIds.includes(product.sub_sub_category_id)
      );
    });
    
    this.applySort();
    
    // Update URL without navigation
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        categoryId: category.category_id,
        categoryName: category.category_name,
      },
      queryParamsHandling: 'merge',
    });
  }

  // Update displayed category tree based on selected category
  updateDisplayedCategoryTree(selectedCategory: any) {
    if (!selectedCategory) {
      this.displayedCategoryTree = this.categoryTree;
      return;
    }

    // Find the root parent of the selected category
    const parentCategory = this.findParentCategory(selectedCategory);
    
    if (parentCategory) {
      // Show only the parent category with all its children
      this.displayedCategoryTree = [parentCategory];
    } else {
      // If it's already a parent, show it with all its children
      this.displayedCategoryTree = [selectedCategory];
    }
  }

  // Find the root parent category of a given category
  findParentCategory(category: any): any {
    if (!category || !category.parent_id) {
      // This is a root category
      return this.findCategoryById(category.category_id, this.categoryTree);
    }

    // Find the parent in allCategories
    const parent = this.allCategories.find((cat: any) => cat.category_id === category.parent_id);
    
    if (parent && parent.parent_id) {
      // Parent also has a parent, recurse
      return this.findParentCategory(parent);
    } else if (parent) {
      // Found root parent
      return this.findCategoryById(parent.category_id, this.categoryTree);
    }
    
    return null;
  }

  // Get all category IDs including the category itself and all its children
  getAllCategoryIds(category: any): string[] {
    const ids = [category.category_id];
    
    if (category.children && category.children.length > 0) {
      category.children.forEach((child: any) => {
        ids.push(...this.getAllCategoryIds(child));
      });
    }
    
    return ids;
  }

  isCategorySelected(category: any): boolean {
    if (!this.selectedCategory) return false;
    
    // Check if this category is the selected category or is in the breadcrumb
    return (
      this.selectedCategory.category_id === category.category_id ||
      this.categoryBreadcrumb.some(
        (crumb: any) => crumb.category_id === category.category_id
      )
    );
  }

  onViewAllCategories() {
    this.selectedCategory = null;
    this.categoryBreadcrumb = [];
    this.displayedCategoryTree = this.categoryTree; // Reset to show all categories
    this.filteredProducts = [...this.products];
    this.applySort();
    
    // Clear category from URL
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
    });
  }

  toggleSortDropdown() {
    this.isSortOpen = !this.isSortOpen;
  }

  selectSort(sortValue: string) {
    this.sortBy = sortValue;
    this.isSortOpen = false;
    this.applySort();
  }

  get selectedSortLabel() {
    const option = this.sortOptions.find((opt) => opt.value === this.sortBy);
    return option ? option.label : 'Featured';
  }

  applySort() {
    const products = [...this.filteredProducts];
    switch (this.sortBy) {
      case 'price-low':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        products.sort((a, b) => (b.id || '').localeCompare(a.id || ''));
        break;
      default:
        // Featured - keep original order
        break;
    }
    this.filteredProducts = products;
  }

  onProductClick(product: any) {
    this.router.navigate(['/product-details'], {
      queryParams: { productId: product.id }
    });
  }

  getDiscountPercentage(product: any): number {
    if (!product.originalPrice) return 0;
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.sort-dropdown')) {
      this.isSortOpen = false;
    }
  }
}