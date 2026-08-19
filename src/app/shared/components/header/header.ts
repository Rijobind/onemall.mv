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
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Signin } from '../../../features/products/models/signin/signin';
import { Signup } from '../../../features/products/models/signup/signup';
import { AuthCustomer, AuthService } from '../../../core/services/auth.service/auth.service';
import { BackendapiServices } from '../../../core/services/backendapi.services/backendapi.services';
import { CartService } from '../../../core/services/cart.service/cart.service';
import { FavoritesService } from '../../../core/services/favorites.service/favorites.service';
import { NotificationService } from '../../../core/services/notifications.service/notifications.service';
import {
  MarketplaceCity,
  MarketplaceRegion,
  RegionSelection,
  RegionService,
} from '../../../core/services/region.service/region.service';
import {
  CurrencyService,
  MarketplaceCurrencyOption,
} from '../../../core/services/currency.service/currency.service';
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
  imports: [CommonModule, FormsModule, Signin, Signup],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit, OnDestroy, AfterViewInit {
  private readonly cartStorageKey = 'cart_items';
  private readonly favoritesStorageKey = 'favorite_products';
  private readonly recentSearchesStorageKey = 'recent_searches';
  private categoryCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private accountMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private routerEventsSub: Subscription | null = null;
  private regionSub: Subscription | null = null;
  private authSub: Subscription | null = null;
  private notificationSub: Subscription | null = null;
  private readonly onAuthUpdated = () => this.syncAuthState();
  private readonly onOpenSignin = () => this.requestGuestSignIn();
  cartCount = 0;
  wishlistCount = 0;
  notificationCount = 0;
  isSigninModalOpen = false;
  isSignupModalOpen = false;
  isAccountMenuOpen = false;
  customer: AuthCustomer | null = null;

  /** Responsive global ads: desktop vs mobile (no rotation). */
  readonly globalAdDesktop = '/global-desktop.png';
  readonly globalAdMobile = '/global-mobile.png';

  categoryTree: any[] = [];
  ProductList: any[] = [];
  activeParent: any = null;
  activeChild: any = null;
  searchQuery: string = '';
  searchSuggestions: SearchSuggestionItem[] = [];
  isSearchDropdownOpen: boolean = false;
  selectedSearchIndex: number = -1;
  recentSearches: Array<{ query: string; image: string }> = [];

  isRegionModalOpen = false;
  regionList: MarketplaceRegion[] = [];
  cityList: MarketplaceCity[] = [];
  modalRegionId = '';
  modalCity = '';
  isCitiesLoading = false;
  isCurrencyDropdownOpen = false;
  currencyOptions: MarketplaceCurrencyOption[] = [];
  private currencySub: Subscription | null = null;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private api: BackendapiServices,
    private favoritesService: FavoritesService,
    private cartService: CartService,
    private regionService: RegionService,
    private authService: AuthService,
    private currencyService: CurrencyService,
    private notificationService: NotificationService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadCategory();
    this.loadRegions();
    this.loadCurrencies();
    this.regionSub = this.regionService.selection$.subscribe(() => {
      this.loadProductList();
    });
    this.currencySub = this.currencyService.currency$.subscribe(() => {
      this.cdr.markForCheck();
    });
    this.authSub = this.authService.customer$.subscribe((customer) => {
      this.customer = customer;
      this.notificationService.refreshUnreadCount();
      this.cdr.markForCheck();
    });
    this.notificationSub = this.notificationService.unreadCount$.subscribe((count) => {
      this.notificationCount = count;
      this.cdr.markForCheck();
    });
    window.addEventListener('auth-updated', this.onAuthUpdated);
    window.addEventListener('open-signin', this.onOpenSignin);
    this.loadCartCount();
    this.loadWishlistCount();
    this.notificationService.refreshUnreadCount();
    this.loadRecentSearches();
    this.syncSearchQueryFromUrl();
    this.syncActiveMobileTabFromUrl();
    this.openSigninFromQueryParams();
    this.routerEventsSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncSearchQueryFromUrl();
        this.syncActiveMobileTabFromUrl();
        this.openSigninFromQueryParams();
      });
  }

  get regionDisplayLabel(): string {
    return this.regionService.displayLabel;
  }

  get currencyDisplayCode(): string {
    return this.currencyService.shortLabel;
  }

  get currencyDisplayLabel(): string {
    return this.currencyService.displayLabel;
  }

  loadCurrencies(): void {
    this.currencyService.loadOptions().subscribe({
      next: (options) => {
        this.currencyOptions = options;
        this.cdr.markForCheck();
      },
      error: () => {
        this.currencyOptions = [];
      },
    });
  }

  toggleCurrencyDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isCurrencyDropdownOpen = !this.isCurrencyDropdownOpen;
    if (this.isCurrencyDropdownOpen) {
      this.isAccountMenuOpen = false;
      this.closeSearchDropdown();
      this.activeMobileTab = 'currency';
      if (!this.currencyOptions.length) {
        this.loadCurrencies();
      }
    } else {
      this.syncActiveMobileTabFromUrl();
    }
  }

  selectCurrency(option: MarketplaceCurrencyOption, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.isCurrencySelected(option)) {
      this.isCurrencyDropdownOpen = false;
      this.syncActiveMobileTabFromUrl();
      return;
    }
    this.isCurrencyDropdownOpen = false;
    this.syncActiveMobileTabFromUrl();

    // setCurrency persists NEXT code, clears cache, and emits currency-updated
    // so pages refetch with the same next currency_code immediately.
    // Preference save runs in parallel — do not wait on it before UI refresh.
    this.currencyService.setCurrency(option.currency_code, option.country_code).subscribe();
    this.loadProductList(option.currency_code);
    this.cdr.markForCheck();
  }

  isCurrencySelected(option: MarketplaceCurrencyOption): boolean {
    return option.currency_code === this.currencyService.currencyCode;
  }

  loadRegions(): void {
    this.regionService.loadRegions().subscribe({
      next: () => {
        this.regionList = this.regionService.regions;
      },
      error: () => {
        this.regionList = [];
      },
    });
  }

  openRegionModal(): void {
    const current = this.regionService.getEffectiveSelection();
    this.modalRegionId = this.resolveModalRegionId(current);
    this.modalCity = String(current.city || '').trim();
    this.isRegionModalOpen = true;
    this.isCurrencyDropdownOpen = false;
    this.closeSearchDropdown();
    this.closeCategoryDropdown();

    if (this.modalRegionId) {
      this.loadCitiesForModal(this.modalRegionId, this.modalCity);
      return;
    }

    const kaafuRegion = this.regionList.find(
      (region) => region.region_name?.toLowerCase() === 'kaafu'
    );
    if (kaafuRegion) {
      this.modalRegionId = kaafuRegion.country_region_id;
      this.modalCity = this.modalCity || 'Male';
      this.loadCitiesForModal(this.modalRegionId, this.modalCity);
    }
  }

  closeRegionModal(): void {
    this.isRegionModalOpen = false;
    this.syncActiveMobileTabFromUrl();
  }

  onModalRegionChange(countryRegionId: string): void {
    this.modalRegionId = countryRegionId;
    this.modalCity = '';
    this.loadCitiesForModal(countryRegionId);
  }

  onModalCityChange(city: string): void {
    this.modalCity = city ?? '';
  }

  private resolveModalRegionId(current: RegionSelection): string {
    const byId = this.regionList.find(
      (region) => region.country_region_id === current.countryRegionId
    );
    if (byId) return byId.country_region_id;

    const name = String(current.regionName || '').trim().toLowerCase();
    if (name) {
      const byName = this.regionList.find(
        (region) => region.region_name?.trim().toLowerCase() === name
      );
      if (byName) return byName.country_region_id;
    }
    return String(current.countryRegionId || '').trim();
  }

  private loadCitiesForModal(countryRegionId: string, preferredCity = ''): void {
    if (!countryRegionId) {
      this.cityList = [];
      return;
    }

    const cityToKeep = preferredCity || this.modalCity;
    this.isCitiesLoading = true;
    this.regionService.loadCities(countryRegionId).subscribe({
      next: () => {
        this.cityList = this.regionService.cities;
        if (cityToKeep) {
          const exact = this.cityList.find((c) => c.city === cityToKeep);
          if (exact) {
            this.modalCity = exact.city;
          } else {
            const loose = this.cityList.find(
              (c) =>
                String(c.city || '').trim().toLowerCase() ===
                cityToKeep.trim().toLowerCase()
            );
            this.modalCity = loose?.city || '';
          }
        }
        this.isCitiesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cityList = [];
        this.isCitiesLoading = false;
      },
    });
  }

  applyRegionSelection(): void {
    const selectedRegion = this.regionList.find(
      (region) => region.country_region_id === this.modalRegionId
    );
    if (!selectedRegion) {
      return;
    }

    const selection: RegionSelection = {
      countryRegionId: selectedRegion.country_region_id,
      regionName: selectedRegion.region_name,
      city: this.modalCity,
    };
    this.regionService.applySelection(selection);
    this.closeRegionModal();
  }

  loadProductList(currencyOverride?: string) {
    const generation = this.currencyService.fetchGeneration;
    const params = this.currencyService.enrichProductParams(
      this.regionService.getProductRequestParams(),
      currencyOverride
    );
    this.api.getMarketplaceProductsWithFallback(params).subscribe({
      next: (res: any) => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
        this.ProductList = this.api.extractProductsFromResponse(res);
      },
      error: () => {
        if (!this.currencyService.isCurrentGeneration(generation)) return;
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

  ngOnDestroy() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.routerEventsSub) {
      this.routerEventsSub.unsubscribe();
      this.routerEventsSub = null;
    }
    if (this.regionSub) {
      this.regionSub.unsubscribe();
      this.regionSub = null;
    }
    if (this.currencySub) {
      this.currencySub.unsubscribe();
      this.currencySub = null;
    }
    if (this.authSub) {
      this.authSub.unsubscribe();
      this.authSub = null;
    }
    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
      this.notificationSub = null;
    }
    window.removeEventListener('auth-updated', this.onAuthUpdated);
    window.removeEventListener('open-signin', this.onOpenSignin);
    if (this.categoryCloseTimeout) {
      clearTimeout(this.categoryCloseTimeout);
      this.categoryCloseTimeout = null;
    }
    this.clearAccountMenuCloseTimer();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-account-menu]')) {
      this.isAccountMenuOpen = false;
    }
    if (!target.closest('[data-currency-dropdown]')) {
      if (this.isCurrencyDropdownOpen) {
        this.isCurrencyDropdownOpen = false;
        this.syncActiveMobileTabFromUrl();
      }
    }
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
    if (!event.key || event.key === this.favoritesStorageKey) {
      this.loadWishlistCount();
    }
  }

  @HostListener('window:cart-updated')
  onCartUpdated() {
    this.loadCartCount();
  }

  @HostListener('window:favorites-updated')
  onFavoritesUpdated() {
    this.loadWishlistCount();
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
  activeMobileTab: 'home' | 'category' | 'location' | 'currency' | 'profile' = 'home';
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

  onHeaderOverlayClick(): void {
    this.closeCategoryDropdown();
    this.closeSearchDropdown();
    this.isAccountMenuOpen = false;
    this.isCurrencyDropdownOpen = false;
  }

  onCategoryMouseEnter() {
    this.openCategoryDropdown();
    this.closeSearchDropdown();
    this.isAccountMenuOpen = false;
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
    this.isCurrencyDropdownOpen = false;
    this.router.navigate(['']);
  }

  onNotifications() {
    this.isMobileSearchOpen = false;
    this.isCurrencyDropdownOpen = false;
    if (!this.authService.isLoggedIn && !this.authService.hasSavedSession) {
      this.requestGuestSignIn();
      return;
    }
    this.router.navigate(['/customer-profile'], {
      queryParams: { section: 'notifications' },
    });
  }

  onFavorites() {
    this.isCurrencyDropdownOpen = false;
    if (!this.authService.isLoggedIn && !this.authService.hasSavedSession) {
      this.requestGuestSignIn();
      return;
    }
    this.router.navigate(['/customer-profile'], {
      queryParams: { section: 'wishlist' },
    });
  }

  /** Open sign-in for guests only (does not toggle account menu). */
  requestGuestSignIn(): void {
    if (this.authService.isLoggedIn || this.authService.hasSavedSession) return;
    this.isAccountMenuOpen = false;
    this.isSigninModalOpen = true;
  }

  onCart() {
    this.isCurrencyDropdownOpen = false;
    this.router.navigate(['/cart']);
  }

  onMobileSearch() {
    this.isMobileSearchOpen = true;
    this.isCurrencyDropdownOpen = false;
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
    this.syncActiveMobileTabFromUrl();
  }

  onMobileCategories() {
    this.activeMobileTab = 'category';
    this.isMobileSearchOpen = false;
    this.isCurrencyDropdownOpen = false;
    this.isSearchDropdownOpen = false;
    this.selectedSearchIndex = -1;
    this.isMobileMenuOpen = false;
    this.router.navigate(['/categories']);
  }

  onMobileLocation() {
    this.activeMobileTab = 'location';
    this.isMobileSearchOpen = false;
    this.isCurrencyDropdownOpen = false;
    this.openRegionModal();
  }

  onMobileCurrency(event?: Event) {
    this.activeMobileTab = 'currency';
    this.isMobileSearchOpen = false;
    this.isAccountMenuOpen = false;
    this.toggleCurrencyDropdown(event);
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
    this.isCurrencyDropdownOpen = false;
    this.isAccountMenuOpen = false;
    this.isSigninModalOpen = true;
  }

  /** Mobile bottom-nav Profile tab */
  onMobileProfile() {
    this.activeMobileTab = 'profile';
    this.isMobileSearchOpen = false;
    this.isCurrencyDropdownOpen = false;
    this.isAccountMenuOpen = false;

    if (this.customer && (this.authService.isLoggedIn || this.authService.hasSavedSession)) {
      // Land on profile hub (no section) so mobile shows the section list
      this.router.navigate(['/customer-profile'], {
        queryParams: {},
      });
      return;
    }

    this.isSigninModalOpen = true;
  }

  onAccountButtonClick(event: Event) {
    event.stopPropagation();
    if (this.customer && (this.authService.isLoggedIn || this.authService.hasSavedSession)) {
      this.clearAccountMenuCloseTimer();
      this.isAccountMenuOpen = !this.isAccountMenuOpen;
      return;
    }
    // Guest: open phone/OTP sign-in modal
    this.openSigninModal();
  }

  private openSigninFromQueryParams() {
    const login = String(this.route.snapshot.queryParamMap.get('login') || '').trim();
    if (login !== '1' && login.toLowerCase() !== 'true') return;
    if (this.customer && this.authService.isLoggedIn) return;

    this.isSigninModalOpen = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { login: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onAccountMenuEnter() {
    if (!(this.authService.isLoggedIn || this.authService.hasSavedSession)) return;
    this.clearAccountMenuCloseTimer();
    this.isAccountMenuOpen = true;
  }

  onAccountMenuLeave() {
    this.clearAccountMenuCloseTimer();
    this.accountMenuCloseTimer = setTimeout(() => {
      this.isAccountMenuOpen = false;
      this.accountMenuCloseTimer = null;
    }, 150);
  }

  private clearAccountMenuCloseTimer() {
    if (this.accountMenuCloseTimer) {
      clearTimeout(this.accountMenuCloseTimer);
      this.accountMenuCloseTimer = null;
    }
  }

  closeSigninModal() {
    this.isSigninModalOpen = false;
  }

  openSignupModal() {
    this.isAccountMenuOpen = false;
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

  onAuthSuccess() {
    this.isSigninModalOpen = false;
    this.isSignupModalOpen = false;
    this.isAccountMenuOpen = false;
    this.syncAuthState();
  }

  logout() {
    this.authService.logout();
    this.isAccountMenuOpen = false;
    this.customer = null;
  }

  goToProfile() {
    this.goToProfileSection('profile');
  }

  goToProfileSection(section: string, extraQuery: Record<string, string> = {}) {
    this.isAccountMenuOpen = false;
    this.router.navigate(['/customer-profile'], {
      queryParams: { section, ...extraQuery },
    });
  }

  get accountLabel(): string {
    if (this.customer?.full_name) {
      return this.customer.full_name.split(' ')[0];
    }
    return 'My account';
  }

  private syncAuthState() {
    this.customer = this.authService.customer;
    if (!this.authService.isLoggedIn && !this.authService.hasSavedSession) {
      this.isAccountMenuOpen = false;
      this.notificationCount = 0;
    }
    this.notificationService.refreshUnreadCount();
    this.cdr.markForCheck();
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
    const display = Number(variant?.display_price);
    if (Number.isFinite(display) && display > 0) return display;
    const price = Number(variant?.base_price);
    return Number.isFinite(price) ? price : 0;
  }

  getSearchProductCurrencySymbol(product: any): string {
    const variant = product?.im_ProductVariants?.[0];
    return String(variant?.display_symbol || product?.display_symbol || '$').trim() || '$';
  }

  private syncSearchQueryFromUrl(): void {
    const queryParams = this.router.parseUrl(this.router.url).queryParams || {};
    const urlSearch = String(queryParams['search'] || '').trim();
    this.searchQuery = urlSearch;
  }

  isMobileTabActive(tab: 'home' | 'category' | 'location' | 'currency' | 'profile'): boolean {
    if (tab === 'location') {
      return this.isRegionModalOpen || this.activeMobileTab === 'location';
    }
    if (tab === 'currency') {
      return this.isCurrencyDropdownOpen || this.activeMobileTab === 'currency';
    }
    return this.activeMobileTab === tab;
  }

  private syncActiveMobileTabFromUrl(): void {
    if (this.isRegionModalOpen) {
      this.activeMobileTab = 'location';
      return;
    }
    if (this.isCurrencyDropdownOpen) {
      this.activeMobileTab = 'currency';
      return;
    }

    const path = this.router.url.split('?')[0] || '';
    if (path === '' || path === '/') {
      this.activeMobileTab = 'home';
      this.isMobileSearchOpen = false;
      return;
    }

    if (path.startsWith('/categories') || path.startsWith('/product-list')) {
      this.activeMobileTab = 'category';
      this.isMobileSearchOpen = false;
      return;
    }

    if (path.startsWith('/customer-profile')) {
      this.activeMobileTab = 'profile';
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

  private loadWishlistCount() {
    this.wishlistCount = this.favoritesService.getCount();
  }

  private loadCartCount() {
    const items = this.cartService.getItems();
    this.cartCount = items.reduce((total, item) => {
      return total + Math.max(1, Number(item?.quantity) || 0);
    }, 0);
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
