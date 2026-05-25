import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Signin } from '../../../features/products/models/signin/signin';
import { Signup } from '../../../features/products/models/signup/signup';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';
import { filter, Subscription } from 'rxjs';

type SearchSuggestionType = 'autocomplete' | 'category';

interface SearchSuggestionItem {
  type: SearchSuggestionType;
  query: string;
  categoryId?: string;
  categoryName?: string;
}

@Component({
  selector: 'app-header',
  imports: [CommonModule, Signin, Signup],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit, OnDestroy, AfterViewInit {
  private readonly cartStorageKey = 'cart_items';
  private readonly recentSearchesStorageKey = 'recent_searches';
  private categoryCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private routerEventsSub: Subscription | null = null;
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
      rightImage: '/Categories2.jpg',
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
  searchQuery: string = '';
  searchSuggestions: SearchSuggestionItem[] = [];
  isSearchDropdownOpen: boolean = false;
  selectedSearchIndex: number = -1;
  recentSearches: Array<{ query: string; image: string }> = [];

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private api: BackendapiServices
  ) {}

  ngOnInit() {
    this.startAdRotation();
    this.loadCategory();
    this.loadProductList();
    this.loadCartCount();
    this.loadRecentSearches();
    this.syncSearchQueryFromUrl();
    this.syncActiveMobileTabFromUrl();
    this.routerEventsSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncSearchQueryFromUrl();
        this.syncActiveMobileTabFromUrl();
      });
  }

  loadProductList() {
    this.api.getAllProductList().subscribe({
      next: (res: any) => {
        this.ProductList = res.data || [];
      },
      error: () => {
        this.ProductList = [];
        this.searchSuggestions = [];
        this.isSearchDropdownOpen = false;
        this.selectedSearchIndex = -1;
      },
    });
  }

  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      const categories = res.data || [];

      // 1. Get parent categories
      const parents = categories.filter((cat: any) => cat.parent_id === null);

      // 2. Build recursive tree
      this.categoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, categories));

      // console.log('Category Tree:', this.categoryTree);
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
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.routerEventsSub) {
      this.routerEventsSub.unsubscribe();
      this.routerEventsSub = null;
    }
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
      this.categoryCloseTimeout = null;
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
    if (!target.closest('.header-search')) {
      this.isSearchDropdownOpen = false;
      this.selectedSearchIndex = -1;
    }
  }

  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent) {
    if (!event.key || event.key === this.cartStorageKey) {
      this.loadCartCount();
    }
  }

  @HostListener('window:cart-updated')
  onCartUpdated() {
    this.loadCartCount();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.updateDesktopHeaderStickyState();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.recalculateDesktopHeaderMetrics();
    this.updateDesktopHeaderStickyState();
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
  activeMobileTab: 'home' | 'search' | 'category' | 'notification' | 'profile' = 'home';
  isMobileSearchOpen = false;
  isDesktopHeaderFixed = false;
  desktopHeaderSpacerHeight = 0;
  private desktopHeaderAnchorTop = 0;
  @ViewChild('desktopHeaderAnchor') desktopHeaderAnchor?: ElementRef<HTMLDivElement>;
  @ViewChild('desktopHeaderRow') desktopHeaderRow?: ElementRef<HTMLDivElement>;
  @ViewChild('mobileSearchInput') mobileSearchInput?: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.recalculateDesktopHeaderMetrics();
      this.updateDesktopHeaderStickyState();
    });
  }

  toggleCategoryDropdown() {
    this.isCategoryOpen = !this.isCategoryOpen;
    if (!this.isCategoryOpen) {
      this.activeParent = null;
      this.activeChild = null;
    }
  }

  openCategoryDropdown() {
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
      this.categoryCloseTimeout = null;
    }
    this.isCategoryOpen = true;
  }

  closeCategoryDropdown() {
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
      this.categoryCloseTimeout = null;
    }
    this.isCategoryOpen = false;
    this.activeParent = null;
    this.activeChild = null;
  }

  onCategoryMouseEnter() {
    this.openCategoryDropdown();
    this.closeSearchDropdown();
  }

  onCategoryMouseLeave() {
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
    }

    this.categoryCloseTimeout = setTimeout(() => {
      this.closeCategoryDropdown();
    }, 180);
  }

  onCategoryMenuMouseEnter() {
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
      this.categoryCloseTimeout = null;
    }
  }

  onCategoryMenuMouseLeave() {
    this.onCategoryMouseLeave();
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
    this.activeMobileTab = 'home';
    this.isMobileSearchOpen = false;
    this.router.navigate(['']);
  }

  onNotifications() {
    this.activeMobileTab = 'notification';
    this.isMobileSearchOpen = false;
    this.router.navigate(['/notification-item']);
  }

  onFavorites() {
    this.router.navigate(['/favorite-products']);
  }

  onCart() {
    this.router.navigate(['/cart']);
  }

  onMobileSearch() {
    this.activeMobileTab = 'search';
    this.isMobileSearchOpen = true;
    this.isSearchDropdownOpen = true;
    this.selectedSearchIndex = this.searchSuggestions.length > 0 ? 0 : -1;
    setTimeout(() => {
      this.mobileSearchInput?.nativeElement?.focus();
    });
  }

  closeMobileSearch() {
    this.isMobileSearchOpen = false;
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
    this.activeMobileTab = 'home';
  }

  onMobileCategories() {
    this.activeMobileTab = 'category';
    this.isMobileSearchOpen = false;
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
    this.toggleMobileMenu();
  }

  onAboutUs() {
    this.router.navigate(['/about-us']);
  }

  onContact() {
    this.router.navigate(['/contact']);
  }

  openSigninModal() {
    this.activeMobileTab = 'profile';
    this.isMobileSearchOpen = false;
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

  onSearchInput(value: string) {
    this.searchQuery = value;
    const term = value.trim().toLowerCase();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    if (!term) {
      this.searchSuggestions = [];
      this.isSearchDropdownOpen = true;
      this.selectedSearchIndex = -1;
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.searchSuggestions = this.buildSearchSuggestions(term);
      this.isSearchDropdownOpen = true;
      this.selectedSearchIndex = this.searchSuggestions.length > 0 ? 0 : -1;
    }, 200);
  }

  onSearchFocus() {
    this.isSearchDropdownOpen = true;
    const term = this.searchQuery.trim().toLowerCase();
    if (term.length > 0) {
      this.searchSuggestions = this.buildSearchSuggestions(term);
      this.selectedSearchIndex = this.searchSuggestions.length > 0 ? 0 : -1;
      return;
    }

    this.searchSuggestions = [];
    this.selectedSearchIndex = -1;
  }

  onSearchKeydown(event: KeyboardEvent) {
    const hasSuggestions = this.searchSuggestions.length > 0;

    if (event.key === 'ArrowDown') {
      if (!hasSuggestions) return;
      event.preventDefault();
      this.isSearchDropdownOpen = true;
      this.selectedSearchIndex = Math.min(
        this.selectedSearchIndex + 1,
        this.searchSuggestions.length - 1
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!hasSuggestions) return;
      event.preventDefault();
      this.isSearchDropdownOpen = true;
      this.selectedSearchIndex = Math.max(this.selectedSearchIndex - 1, 0);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (
        this.isSearchDropdownOpen &&
        this.selectedSearchIndex >= 0 &&
        this.selectedSearchIndex < this.searchSuggestions.length
      ) {
        this.onSelectSearchSuggestion(this.searchSuggestions[this.selectedSearchIndex]);
        return;
      }

      this.onSearch();
      return;
    }

    if (event.key === 'Escape') {
      this.isSearchDropdownOpen = false;
      this.selectedSearchIndex = -1;
    }
  }

  onSearch() {
    const term = this.searchQuery.trim();
    if (!term) return;

    this.addRecentSearch(term);
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
    const isMobile = window.innerWidth < 768;
    this.router.navigate(['/search-result'], {
      queryParams: { search: term },
    });
    if (isMobile) {
      this.isMobileSearchOpen = false;
      this.activeMobileTab = 'search';
    }
  }

  onSelectSearchSuggestion(suggestion: SearchSuggestionItem) {
    const query = (suggestion?.query || '').trim();
    if (!query) return;

    this.searchQuery = query;
    this.addRecentSearch(query);
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
    const isMobile = window.innerWidth < 768;
    this.router.navigate(['/search-result'], {
      queryParams: {
        search: query,
        categoryId: suggestion.categoryId || undefined,
        categoryName: suggestion.categoryName || undefined,
      },
    });
    if (isMobile) {
      this.isMobileSearchOpen = false;
      this.activeMobileTab = 'search';
    }
  }

  onSearchSuggestionHover(index: number) {
    this.selectedSearchIndex = index;
  }

  closeSearchDropdown() {
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
  }

  onRecentSearchClick(recent: { query: string; image: string }) {
    if (!recent?.query) return;
    this.searchQuery = recent.query;
    this.onSearch();
  }

  removeRecentSearch(recentQuery: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const target = (recentQuery || '').trim().toLowerCase();
    this.recentSearches = this.recentSearches.filter(
      (item) => item.query.trim().toLowerCase() !== target
    );
    this.saveRecentSearches();
  }

  clearRecentSearches(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    this.recentSearches = [];
    localStorage.removeItem(this.recentSearchesStorageKey);
  }

  get shouldShowRecentSearches(): boolean {
    return this.isSearchDropdownOpen && this.searchQuery.trim().length === 0;
  }

  private loadRecentSearches() {
    const stored = localStorage.getItem(this.recentSearchesStorageKey);
    if (!stored) {
      this.recentSearches = [];
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      this.recentSearches = Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch {
      this.recentSearches = [];
    }
  }

  private saveRecentSearches() {
    localStorage.setItem(
      this.recentSearchesStorageKey,
      JSON.stringify(this.recentSearches.slice(0, 10))
    );
  }

  private addRecentSearch(query: string, image?: string) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    const fallbackImage =
      image ||
      this.getSearchProductImage(
        this.ProductList.find((product: any) =>
          (product?.title || '').toLowerCase() === normalizedQuery.toLowerCase()
        )
      );

    this.recentSearches = this.recentSearches.filter(
      (item) => item.query.toLowerCase() !== normalizedQuery.toLowerCase()
    );
    this.recentSearches.unshift({
      query: normalizedQuery,
      image: fallbackImage || '/mobile.jpg',
    });
    this.recentSearches = this.recentSearches.slice(0, 10);
    this.saveRecentSearches();
  }

  getSearchProductImage(product: any): string {
    const variant = product?.im_ProductVariants?.[0];
    const images = variant?.im_ProductImages || [];
    const primaryImage = images.find((img: any) => img?.is_primary === 'T') || images[0];
    return primaryImage?.image_url || product?.thumbnail_url || '/mobile.jpg';
  }

  getSearchProductPrice(product: any): number {
    const variant = product?.im_ProductVariants?.[0];
    const price = Number(variant?.base_price);
    return Number.isFinite(price) ? price : 0;
  }

  private syncSearchQueryFromUrl(): void {
    const queryParams = this.router.parseUrl(this.router.url).queryParams || {};
    const urlSearch = String(queryParams['search'] || '').trim();
    this.searchQuery = urlSearch;
  }

  isMobileTabActive(tab: 'home' | 'search' | 'category' | 'notification' | 'profile'): boolean {
    return this.activeMobileTab === tab;
  }

  private syncActiveMobileTabFromUrl(): void {
    const path = this.router.url.split('?')[0] || '';
    if (path === '' || path === '/') {
      this.activeMobileTab = 'home';
      this.isMobileSearchOpen = false;
      return;
    }

    if (path.startsWith('/notification-item')) {
      this.activeMobileTab = 'notification';
      this.isMobileSearchOpen = false;
      return;
    }

    if (path.startsWith('/product-list') || path.startsWith('/search-result')) {
      this.activeMobileTab = 'search';
      this.isMobileSearchOpen = false;
      return;
    }

    this.isMobileSearchOpen = false;
  }

  private buildSearchSuggestions(term: string): SearchSuggestionItem[] {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm) return [];

    const textCandidates = new Set<string>();
    this.ProductList.forEach((product: any) => {
      const title = (product?.title || '').trim();
      const brand = (product?.brand || '').trim();
      if (title) textCandidates.add(title);
      if (brand) textCandidates.add(brand);
    });

    const scoredText = Array.from(textCandidates)
      .map((text) => {
        const lower = text.toLowerCase();
        const idx = lower.indexOf(normalizedTerm);
        let score = 99;
        if (idx === 0) score = 0;
        else if (idx > 0) score = 1;
        else score = 100;
        return { text, score };
      })
      .filter((entry) => entry.score < 100)
      .sort((a, b) => a.score - b.score || a.text.length - b.text.length || a.text.localeCompare(b.text))
      .slice(0, 7)
      .map((entry) => ({
        type: 'autocomplete' as const,
        query: entry.text,
      }));

    const categorySuggestions = this.flattenCategories(this.categoryTree)
      .filter((category) => category.name.toLowerCase().includes(normalizedTerm))
      .slice(0, 3)
      .map((category) => ({
        type: 'category' as const,
        query: term.trim(),
        categoryId: category.id,
        categoryName: category.name,
      }));

    return [...scoredText, ...categorySuggestions].slice(0, 10);
  }

  private flattenCategories(nodes: any[]): Array<{ id: string; name: string }> {
    const categories: Array<{ id: string; name: string }> = [];
    const visit = (node: any) => {
      if (!node) return;
      if (node.category_name) {
        categories.push({
          id: String(node.category_id || ''),
          name: String(node.category_name),
        });
      }
      const children = Array.isArray(node.children) ? node.children : [];
      children.forEach(visit);
    };
    (nodes || []).forEach(visit);
    return categories;
  }

  getSuggestionPrimaryText(suggestion: SearchSuggestionItem): string {
    return suggestion?.query || '';
  }

  getSuggestionSuffix(suggestion: SearchSuggestionItem): string {
    if (suggestion?.type === 'category' && suggestion?.categoryName) {
      return ` in ${suggestion.categoryName}`;
    }
    return '';
  }

  suggestionStartsWithInput(suggestion: SearchSuggestionItem): boolean {
    const input = this.searchQuery.trim().toLowerCase();
    if (!input) return false;
    return (suggestion?.query || '').toLowerCase().startsWith(input);
  }

  getSuggestionTypedPart(suggestion: SearchSuggestionItem): string {
    const primary = this.getSuggestionPrimaryText(suggestion);
    const input = this.searchQuery.trim();
    if (!input) return primary;
    if (primary.toLowerCase().startsWith(input.toLowerCase())) {
      return primary.slice(0, input.length);
    }
    return primary;
  }

  getSuggestionRemainingPart(suggestion: SearchSuggestionItem): string {
    const primary = this.getSuggestionPrimaryText(suggestion);
    const input = this.searchQuery.trim();
    if (!input) return '';
    if (primary.toLowerCase().startsWith(input.toLowerCase())) {
      return primary.slice(input.length);
    }
    return '';
  }

  private loadCartCount() {
    const storedCart = localStorage.getItem(this.cartStorageKey);
    if (!storedCart) {
      this.cartCount = 0;
      return;
    }

    try {
      const parsed = JSON.parse(storedCart);
      if (!Array.isArray(parsed)) {
        this.cartCount = 0;
        return;
      }

      this.cartCount = parsed.reduce((total: number, item: any) => {
        return total + Math.max(1, Number(item?.quantity) || 0);
      }, 0);
    } catch {
      this.cartCount = 0;
    }
  }

  private recalculateDesktopHeaderMetrics() {
    if (!this.desktopHeaderAnchor || !this.desktopHeaderRow) return;

    const anchorEl = this.desktopHeaderAnchor.nativeElement;
    const rowEl = this.desktopHeaderRow.nativeElement;
    this.desktopHeaderAnchorTop = anchorEl.getBoundingClientRect().top + window.scrollY;
    this.desktopHeaderSpacerHeight = rowEl.offsetHeight || 0;
  }

  private updateDesktopHeaderStickyState() {
    if (typeof window === 'undefined') return;

    if (!this.desktopHeaderAnchorTop) {
      this.recalculateDesktopHeaderMetrics();
    }

    this.isDesktopHeaderFixed = window.scrollY >= this.desktopHeaderAnchorTop;
  }
}
