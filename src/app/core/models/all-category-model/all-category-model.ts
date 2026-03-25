import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-all-category-model',
  imports: [CommonModule],
  templateUrl: './all-category-model.html',
  styleUrl: './all-category-model.css',
})
export class AllCategoryModel implements OnInit, OnChanges {
  @Input() isOpen: boolean = false;
  @Input() categoryTree: any[] = [];
  @Output() closeModal = new EventEmitter<void>();

  allCategoriesFlat: any[] = [];
  selectedCategory: any = null;
  showingSubcategories: boolean = false;
  categoryHistory: any[] = []; // Stack to track navigation history

  constructor(private router: Router) {}

  ngOnInit() {
    this.flattenCategories();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['categoryTree'] && this.categoryTree && this.categoryTree.length > 0) {
      this.flattenCategories();
    }
  }

  // Flatten the category tree to show all categories in a grid
  // Organize: parents first, then children, then grandchildren
  flattenCategories() {
    this.allCategoriesFlat = [];
    if (this.categoryTree && this.categoryTree.length > 0) {
      // First, add all parent categories
      this.categoryTree.forEach((category) => {
        this.allCategoriesFlat.push({ ...category, level: 'parent' });
      });
      
      // Then, add all children
      this.categoryTree.forEach((category) => {
        if (category.children && category.children.length > 0) {
          category.children.forEach((child: any) => {
            this.allCategoriesFlat.push({ ...child, level: 'child' });
          });
        }
      });
      
      // Finally, add all grandchildren
      this.categoryTree.forEach((category) => {
        if (category.children && category.children.length > 0) {
          category.children.forEach((child: any) => {
            if (child.children && child.children.length > 0) {
              child.children.forEach((grandchild: any) => {
                this.allCategoriesFlat.push({ ...grandchild, level: 'grandchild' });
              });
            }
          });
        }
      });
    }
  }

  onClose() {
    this.selectedCategory = null;
    this.showingSubcategories = false;
    this.categoryHistory = [];
    this.closeModal.emit();
  }

  onCategoryClick(category: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    // If category has children, show subcategories
    if (category.children && category.children.length > 0) {
      this.selectedCategory = category;
      this.showingSubcategories = true;
      this.categoryHistory = [category]; // Initialize history
    } else {
      // If no children, navigate to product list
      this.onClose();
      this.router.navigate(['/product-list'], {
        queryParams: {
          categoryId: category.category_id,
          categoryName: category.category_name
        }
      });
    }
  }

  onBackClick() {
    if (this.categoryHistory.length > 1) {
      // Go back one level
      this.categoryHistory.pop();
      this.selectedCategory = this.categoryHistory[this.categoryHistory.length - 1];
    } else {
      // Go back to main categories view
      this.selectedCategory = null;
      this.showingSubcategories = false;
      this.categoryHistory = [];
    }
  }

  onSubcategoryClick(subcategory: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    // If subcategory has children (grandchildren), show them
    if (subcategory.children && subcategory.children.length > 0) {
      this.categoryHistory.push(subcategory); // Add to history
      this.selectedCategory = subcategory;
      this.showingSubcategories = true;
    } else {
      // If no children, navigate to product list
      this.onClose();
      this.router.navigate(['/product-list'], {
        queryParams: {
          categoryId: subcategory.category_id,
          categoryName: subcategory.category_name
        }
      });
    }
  }

  // Prevent modal from closing when clicking inside
  onModalClick(event: Event) {
    event.stopPropagation();
  }

  // Close modal on Escape key
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: any) {
    if (this.isOpen) {
      this.onClose();
    }
  }
}
