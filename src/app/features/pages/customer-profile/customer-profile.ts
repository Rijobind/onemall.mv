import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Header } from '../../../shared/components/header/header';
import { Footer } from '../../../shared/components/footer/footer';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { ProfileImageModal } from '../../../shared/components/profile-image-modal/profile-image-modal';
import {AuthCustomer,AuthService,} from '../../../core/services/auth.service/auth.service';
import {AddressService,CustomerAddress,CustomerAddressPayload,} from '../../../core/services/address.service/address.service';
import {FavoriteProduct as FavoriteProductItem,FavoritesService,} from '../../../core/services/favorites.service/favorites.service';
import {CustomerNotification,NotificationService,} from '../../../core/services/notifications.service/notifications.service';
import { MarketplaceShopService } from '../../../core/services/marketplace-shop.service/marketplace-shop.service';
import { ShopNameLink } from '../../../shared/components/shop-name-link/shop-name-link';
import { ActionFeedbackService } from '../../../core/services/action-feedback.service/action-feedback.service';
import { CartService } from '../../../core/services/cart.service/cart.service';
import { buildProductCommands } from '../../../core/utils/product-url.util';
import {MarketplaceCity,MarketplaceRegion,RegionSelection,RegionService,} from '../../../core/services/region.service/region.service';
import {CurrencyService,MarketplaceCurrencyOption,} from '../../../core/services/currency.service/currency.service';
import {FollowedStore,FollowService,} from '../../../core/services/follow.service/follow.service';

export type ProfileSection =
  | 'orders'
  | 'reviews'
  | 'profile'
  | 'wishlist'
  | 'followed'
  | 'history'
  | 'addresses'
  | 'region'
  | 'security'
  | 'notifications';

interface NavItem {
  id: ProfileSection;
  label: string;
  icon: string;
  expandable?: boolean;
}

const VALID_SECTIONS: ProfileSection[] = [
  'orders',
  'reviews',
  'profile',
  'wishlist',
  'followed',
  'history',
  'addresses',
  'region',
  'security',
  'notifications',
];

@Component({
  selector: 'app-customer-profile',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    Header,
    Footer,
    ShopNameLink,
    ConfirmDialog,
    ProfileImageModal,
  ],
  templateUrl: './customer-profile.html',
  styleUrl: './customer-profile.css',
})
export class CustomerProfile implements OnInit, OnDestroy {
  customer: AuthCustomer | null = null;
  activeSection: ProfileSection = 'profile';
  /** On mobile: true = section list hub; false = drilled into a section */
  mobileShowMenu = false;
  ordersOpen = false;
  private authSub: Subscription | null = null;
  private querySub: Subscription | null = null;
  private favoritesSub: Subscription | null = null;

  /** Addresses section state */
  addresses: CustomerAddress[] = [];
  addressesLoading = false;
  addressError = '';
  addressSuccess = '';
  addressActionId: string | null = null;
  editingId: string | null = null;
  savingEdit = false;

  /** Profile image */
  profileImageModalOpen = false;
  profileImageUploading = false;
  profileImageRemoving = false;
  profileImageError = '';
  profileImageSuccess = '';

  /** Edit profile modal (name + addresses) */
  profileEditModalOpen = false;
  editFullName = '';
  savingProfileName = false;
  profileNameError = '';
  profileNameSuccess = '';

  /** Wishlist section state */
  favoriteProducts: FavoriteProductItem[] = [];
  wishlistLoading = false;

  /** Notifications section state */
  notifications: CustomerNotification[] = [];
  notificationUnreadCount = 0;
  notificationsLoading = false;
  notificationsError = '';

  /** Followed stores section state */
  followedStores: FollowedStore[] = [];
  followedLoading = false;
  followedError = '';

  /** Location / region section state (same as header "Choose your location") */
  regionList: MarketplaceRegion[] = [];
  cityList: MarketplaceCity[] = [];
  profileRegionId = '';
  profileCity = '';
  isCitiesLoading = false;
  regionSaveMessage = '';
  regionSaveError = '';

  /** Currency options shown under the location section */
  currencyOptions: MarketplaceCurrencyOption[] = [];
  currencySaveMessage = '';

  /** Shared confirm dialog state */
  isConfirmOpen = false;
  confirmTitle = 'Are you sure?';
  confirmMessage = 'This action cannot be undone.';
  confirmLabel = 'Yes, delete';
  private pendingConfirmAction: (() => void) | null = null;

  /** Right-rail ads */
  profileAds = [
    {
      image: '/mobile3.jpg',
      title: 'CYBER MONDAY SALE',
      description: "Don't miss out on amazing deals!",
      discount: '75% OFF',
      buttonText: 'Shop Now',
    },
    {
      image: '/mobile4.jpg',
      title: 'SUMMER COLLECTION',
      description: 'New arrivals with exclusive discounts!',
      discount: '50% OFF',
      buttonText: 'Explore Now',
    },
    {
      image: '/mobile2.jpg',
      title: 'FLASH SALE',
      description: "Limited time offers — shop before they're gone!",
      discount: '60% OFF',
      buttonText: 'Shop Now',
    },
    {
      image: '/mobile.jpg',
      title: 'WEEKEND SPECIAL',
      description: 'Extra savings on selected items this weekend!',
      discount: '40% OFF',
      buttonText: 'Shop Now',
    },
  ];
  currentAdIndex = 0;
  adFading = false;
  private adInterval: ReturnType<typeof setInterval> | null = null;
  private adFadeTimer: ReturnType<typeof setTimeout> | null = null;

  editForm: CustomerAddressPayload = {
    address_type: 'HOME',
    contact_name: '',
    contact_phone: '',
    address_line1: '',
    land_mark: '',
    city: '',
    state_region: '',
    postal_code: '',
    country_code: 'MV',
    is_default: false,
  };

  readonly addressTypes = [
    { value: 'HOME', label: 'Home' },
    { value: 'WORK', label: 'Work' },
    { value: 'OTHER', label: 'Other' },
  ];

  readonly navItems: NavItem[] = [
    { id: 'profile', label: 'Your profile', icon: 'profile' },
    { id: 'orders', label: 'Your orders', icon: 'orders', expandable: true },
    { id: 'reviews', label: 'Your reviews', icon: 'reviews' },
    { id: 'wishlist', label: 'Wishlist', icon: 'wishlist' },
    { id: 'followed', label: 'Followed stores', icon: 'followed' },
    { id: 'history', label: 'Browsing history', icon: 'history' },
    { id: 'region', label: 'Region & Currency', icon: 'region' },
    { id: 'security', label: 'Account security', icon: 'security' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  ];

  constructor(
    private auth: AuthService,
    private addressService: AddressService,
    private favoritesService: FavoritesService,
    private notificationService: NotificationService,
    private shopService: MarketplaceShopService,
    private cartService: CartService,
    private actionFeedback: ActionFeedbackService,
    private regionService: RegionService,
    private currencyService: CurrencyService,
    private followService: FollowService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.startAdRotation();

    this.authSub = this.auth.customer$.subscribe((customer) => {
      this.customer = customer;
      if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
        this.router.navigate(['/'], { queryParams: { login: '1' } });
      }
    });

    this.favoritesSub = this.favoritesService.favorites$.subscribe(() => {
      if (this.activeSection === 'wishlist') {
        this.refreshWishlist();
      }
    });

    this.querySub = this.route.queryParamMap.subscribe((params) => {
      let section = String(params.get('section') || '').trim() as ProfileSection;
      // Old addresses tab → Your profile
      if (section === 'addresses') {
        section = 'profile';
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { section: 'profile' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
      if (section && VALID_SECTIONS.includes(section)) {
        this.activeSection = section;
        this.mobileShowMenu = false;
        if (section === 'orders') this.ordersOpen = true;
        this.onSectionActivated(section);
      } else {
        // Mobile hub when no section; desktop keeps showing the default profile panel
        this.mobileShowMenu = this.isMobileViewport();
        if (!this.mobileShowMenu) {
          this.onSectionActivated(this.activeSection);
        }
      }

      if (params.get('edit') === '1' && this.auth.isLoggedIn) {
        this.openProfileEditModal();
      }
    });

    if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
      this.router.navigate(['/'], { queryParams: { login: '1' } });
    } else if (this.auth.isLoggedIn) {
      this.auth.refreshCustomerProfile().subscribe({ error: () => undefined });
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.querySub?.unsubscribe();
    this.favoritesSub?.unsubscribe();
    this.stopAdRotation();
  }

  selectSection(id: ProfileSection): void {
    this.mobileShowMenu = false;
    this.activeSection = id;
    if (id === 'orders') {
      this.ordersOpen = true;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: id },
      queryParamsHandling: 'merge',
    });
    this.onSectionActivated(id);
  }

  backToMobileMenu(): void {
    this.mobileShowMenu = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: null },
      queryParamsHandling: 'merge',
    });
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
  }

  private onSectionActivated(id: ProfileSection): void {
    if (id === 'profile' || id === 'addresses') this.loadAddresses();
    if (id === 'wishlist') this.loadWishlist();
    if (id === 'followed') this.loadFollowedStores();
    if (id === 'notifications') this.loadNotifications();
    if (id === 'region') this.initLocationSection();
  }

  get activeLabel(): string {
    return this.navItems.find((n) => n.id === this.activeSection)?.label || 'Profile';
  }

  get currentLocationLabel(): string {
    return this.regionService.displayLabel;
  }

  get selectedCurrencyCode(): string {
    return this.currencyService.currencyCode;
  }

  get initials(): string {
    const name = this.customer?.full_name?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get phoneDisplay(): string {
    if (!this.customer?.country_code && !this.customer?.phone_number) return '—';
    return `${this.customer?.country_code || ''} ${this.customer?.phone_number || ''}`.trim();
  }

  get profileImageUrl(): string | null {
    const url = this.customer?.profile_image_url;
    return url ? String(url) : null;
  }

  get currentAd() {
    return this.profileAds[this.currentAdIndex];
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  openProfileEditModal(): void {
    this.editFullName = this.customer?.full_name || '';
    this.profileNameError = '';
    this.profileNameSuccess = '';
    this.addressError = '';
    this.addressSuccess = '';
    this.editingId = null;
    this.profileEditModalOpen = true;
    this.loadAddresses();
  }

  closeProfileEditModal(): void {
    if (this.savingProfileName || this.savingEdit) return;
    this.profileEditModalOpen = false;
    this.editingId = null;
    this.profileNameError = '';
    this.profileNameSuccess = '';
    // Drop ?edit=1 from URL if present
    if (this.route.snapshot.queryParamMap.get('edit')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { edit: null },
        queryParamsHandling: 'merge',
      });
    }
  }

  saveProfileName(): void {
    const full_name = this.editFullName.trim();
    if (!full_name) {
      this.profileNameError = 'Name is required.';
      return;
    }
    this.savingProfileName = true;
    this.profileNameError = '';
    this.profileNameSuccess = '';
    const updated = this.auth.updateLocalCustomer({ full_name });
    this.savingProfileName = false;
    if (!updated) {
      this.profileNameError = 'Could not update name.';
      return;
    }
    this.customer = updated;
    this.profileNameSuccess = 'Name updated.';
  }

  openProfileImageModal(): void {
    if (this.profileImageUploading || this.profileImageRemoving) return;
    this.profileImageError = '';
    this.profileImageSuccess = '';
    this.profileImageModalOpen = true;
  }

  closeProfileImageModal(): void {
    if (this.profileImageUploading || this.profileImageRemoving) return;
    this.profileImageModalOpen = false;
    this.profileImageError = '';
  }

  onProfileImageCropped(file: File): void {
    this.uploadProfileImage(file);
  }

  uploadProfileImage(file: File): void {
    this.profileImageUploading = true;
    this.profileImageError = '';
    this.profileImageSuccess = '';
    this.auth.uploadProfileImage(file).subscribe({
      next: () => {
        this.profileImageUploading = false;
        this.profileImageModalOpen = false;
        this.profileImageSuccess = 'Profile photo updated.';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.profileImageUploading = false;
        this.profileImageError = err?.message || 'Could not upload photo.';
        this.cdr.markForCheck();
      },
    });
  }

  removeProfileImage(): void {
    if (!this.profileImageUrl || this.profileImageUploading || this.profileImageRemoving) {
      return;
    }
    this.profileImageRemoving = true;
    this.profileImageError = '';
    this.profileImageSuccess = '';
    this.auth.removeProfileImage().subscribe({
      next: () => {
        this.profileImageRemoving = false;
        this.profileImageModalOpen = false;
        this.profileImageSuccess = 'Profile photo removed.';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.profileImageRemoving = false;
        this.profileImageError = err?.message || 'Could not remove photo.';
        this.cdr.markForCheck();
      },
    });
  }

  onAdClick(): void {
    this.router.navigate(['/product-list']);
  }

  private startAdRotation(): void {
    this.stopAdRotation();
    this.adInterval = setInterval(() => {
      this.adFading = true;
      this.adFadeTimer = setTimeout(() => {
        this.currentAdIndex = (this.currentAdIndex + 1) % this.profileAds.length;
        this.adFading = false;
      }, 450);
    }, 5000);
  }

  private stopAdRotation(): void {
    if (this.adInterval) {
      clearInterval(this.adInterval);
      this.adInterval = null;
    }
    if (this.adFadeTimer) {
      clearTimeout(this.adFadeTimer);
      this.adFadeTimer = null;
    }
  }

  /* ---------- Location (Country/Region) ---------- */

  initLocationSection(): void {
    this.regionSaveMessage = '';
    this.regionSaveError = '';
    this.currencySaveMessage = '';
    this.loadRegionsForProfile();
    this.loadCurrenciesForProfile();
  }

  private loadRegionsForProfile(): void {
    this.regionService.loadRegions().subscribe({
      next: () => {
        this.regionList = this.regionService.regions;
        this.hydrateLocationForm();
      },
      error: () => {
        this.regionList = [];
        this.regionSaveError = 'Could not load regions.';
      },
    });
  }

  private loadCurrenciesForProfile(): void {
    this.currencyService.loadOptions().subscribe({
      next: (options) => {
        this.currencyOptions = options;
      },
      error: () => {
        this.currencyOptions = [];
      },
    });
  }

  private hydrateLocationForm(): void {
    const current = this.regionService.getEffectiveSelection();
    this.profileRegionId = this.resolveProfileRegionId(current);
    this.profileCity = String(current.city || '').trim();

    if (this.profileRegionId) {
      this.loadCitiesForProfile(this.profileRegionId, this.profileCity);
      return;
    }

    const kaafuRegion = this.regionList.find(
      (region) => region.region_name?.toLowerCase() === 'kaafu'
    );
    if (kaafuRegion) {
      this.profileRegionId = kaafuRegion.country_region_id;
      this.profileCity = this.profileCity || 'Male';
      this.loadCitiesForProfile(this.profileRegionId, this.profileCity);
    }
  }

  private resolveProfileRegionId(current: RegionSelection): string {
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

  onProfileRegionChange(countryRegionId: string): void {
    this.profileRegionId = countryRegionId;
    this.profileCity = '';
    this.regionSaveMessage = '';
    this.regionSaveError = '';
    this.loadCitiesForProfile(countryRegionId);
  }

  onProfileCityChange(city: string): void {
    this.profileCity = city ?? '';
  }

  private loadCitiesForProfile(countryRegionId: string, preferredCity = ''): void {
    if (!countryRegionId) {
      this.cityList = [];
      return;
    }

    const cityToKeep = preferredCity || this.profileCity;
    this.isCitiesLoading = true;
    this.regionService.loadCities(countryRegionId).subscribe({
      next: () => {
        this.cityList = this.regionService.cities;
        if (cityToKeep) {
          const exact = this.cityList.find((c) => c.city === cityToKeep);
          if (exact) {
            this.profileCity = exact.city;
          } else {
            const loose = this.cityList.find(
              (c) =>
                String(c.city || '').trim().toLowerCase() ===
                cityToKeep.trim().toLowerCase()
            );
            this.profileCity = loose?.city || '';
          }
        }
        this.isCitiesLoading = false;
      },
      error: () => {
        this.cityList = [];
        this.isCitiesLoading = false;
      },
    });
  }

  applyProfileLocation(): void {
    const selectedRegion = this.regionList.find(
      (region) => region.country_region_id === this.profileRegionId
    );
    if (!selectedRegion) {
      this.regionSaveError = 'Please select an atoll.';
      return;
    }

    const selection: RegionSelection = {
      countryRegionId: selectedRegion.country_region_id,
      regionName: selectedRegion.region_name,
      city: this.profileCity,
    };
    this.regionService.applySelection(selection);
    this.regionSaveError = '';
    this.regionSaveMessage = 'Location updated.';
  }

  selectProfileCurrency(option: MarketplaceCurrencyOption): void {
    if (this.isCurrencySelected(option)) return;
    this.currencyService.setCurrency(option.currency_code, option.country_code).subscribe();
    this.currencySaveMessage = `Currency set to ${option.currency_code}.`;
  }

  isCurrencySelected(option: MarketplaceCurrencyOption): boolean {
    return option.currency_code === this.currencyService.currencyCode;
  }

  /* ---------- Wishlist ---------- */

  loadWishlist(): void {
    this.refreshWishlist();
    if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) return;

    this.wishlistLoading = true;
    this.favoritesService.loadFromServer().subscribe({
      next: () => {
        this.wishlistLoading = false;
        this.refreshWishlist();
      },
      error: () => {
        this.wishlistLoading = false;
        this.refreshWishlist();
      },
    });
  }

  private refreshWishlist(): void {
    const items = this.favoritesService.getFavorites();
    this.favoriteProducts = items;
    this.cdr.markForCheck();
    this.shopService.enrichWithShopNames(items as any[]).subscribe({
      next: (enriched) => {
        this.favoriteProducts = enriched as FavoriteProductItem[];
        this.cdr.markForCheck();
      },
      error: () => {
        /* items already shown */
      },
    });
  }

  removeFromWishlist(id: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.openConfirm({
      title: 'Remove from wishlist?',
      message: 'Are you sure you want to remove this product from your wishlist?',
      confirmLabel: 'Yes, remove',
      action: () => this.favoritesService.remove(id),
    });
  }

  loadFollowedStores(): void {
    this.followedLoading = true;
    this.followedError = '';
    this.followService.getFollowedStores().subscribe({
      next: (stores) => {
        this.followedStores = stores;
        this.followedLoading = false;
      },
      error: () => {
        this.followedStores = [];
        this.followedLoading = false;
        this.followedError = 'Could not load followed stores.';
      },
    });
  }

  unfollowStore(store: FollowedStore, event?: Event): void {
    event?.stopPropagation();
    if (!store?.store_id) return;
    this.openConfirm({
      title: 'Unfollow store?',
      message: `Are you sure you want to unfollow ${store.store_name || 'this store'}?`,
      confirmLabel: 'Yes, unfollow',
      action: () => {
        this.followService.unfollow(store.store_id).subscribe({
          next: (ok) => {
            if (ok) {
              this.followedStores = this.followedStores.filter(
                (s) => s.store_id !== store.store_id
              );
            }
          },
        });
      },
    });
  }

  openFollowedStore(store: FollowedStore): void {
    const storeId = String(store?.store_id || '').trim();
    if (!storeId) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('store_id', storeId);
    }
    this.router.navigate(['/shop-details'], {
      queryParams: { store_id: storeId },
    });
  }

  onWishlistProductClick(product: FavoriteProductItem): void {
    const storeId = product.store_id ? String(product.store_id) : '';
    if (storeId) localStorage.setItem('store_id', storeId);
    const link = buildProductCommands(product);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  addWishlistToCart(product: FavoriteProductItem, event?: MouseEvent): void {
    event?.stopPropagation();
    const productId = String(product?.id ?? '');
    if (!productId) return;

    this.cartService.addItem(
      {
        id: productId,
        variantId: 'default',
        name: product?.name || 'Untitled Product',
        price: Number(product?.price) || 0,
        originalPrice: Number(product?.originalPrice) || 0,
        image: product?.image || '/mobile.jpg',
        quantity: 1,
        inStock: product?.inStock !== false,
        store_id: product?.store_id ? String(product.store_id) : undefined,
        store_name: product?.store_name || undefined,
        shop_location: product?.shop_location || undefined,
        store_currency_code: product?.store_currency_code || undefined,
        store_currency_symbol: product?.store_currency_symbol || '$',
      },
      1,
      { quantityMode: 'add' }
    );
    this.actionFeedback.feedback(event, 'cart', { image: product?.image });
  }

  /* ---------- Notifications ---------- */

  loadNotifications(): void {
    this.notificationsError = '';
    if (!this.auth.isLoggedIn) {
      this.notifications = [];
      this.notificationUnreadCount = 0;
      this.notificationsLoading = false;
      return;
    }

    this.notificationsLoading = true;
    this.notificationService.loadNotifications({ page: 1, page_size: 50 }).subscribe({
      next: (result) => {
        this.notifications = result.items;
        this.notificationUnreadCount = result.unreadCount;
        this.notificationsLoading = false;
      },
      error: () => {
        this.notifications = [];
        this.notificationUnreadCount = 0;
        this.notificationsLoading = false;
        this.notificationsError = 'Could not load notifications.';
      },
    });
  }

  markNotificationRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id);
    if (!notification || notification.read) return;

    notification.read = true;
    this.notificationUnreadCount = Math.max(0, this.notificationUnreadCount - 1);

    this.notificationService.markRead(id).subscribe({
      next: (ok) => {
        if (!ok) {
          notification.read = false;
          this.notificationUnreadCount += 1;
        }
      },
      error: () => {
        notification.read = false;
        this.notificationUnreadCount += 1;
      },
    });
  }

  markAllNotificationsRead(): void {
    if (this.notificationUnreadCount <= 0) return;
    const prev = this.notifications.map((n) => ({ ...n }));
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.notificationUnreadCount = 0;

    this.notificationService.markAllRead().subscribe({
      next: (ok) => {
        if (!ok) {
          this.notifications = prev;
          this.notificationUnreadCount = prev.filter((n) => !n.read).length;
        }
      },
      error: () => {
        this.notifications = prev;
        this.notificationUnreadCount = prev.filter((n) => !n.read).length;
      },
    });
  }

  deleteNotification(id: string): void {
    this.openConfirm({
      title: 'Delete notification?',
      message: 'Are you sure you want to delete this notification?',
      confirmLabel: 'Yes, delete',
      action: () => this.executeDeleteNotification(id),
    });
  }

  private executeDeleteNotification(id: string): void {
    const prev = [...this.notifications];
    const target = this.notifications.find((n) => n.id === id);
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (target && !target.read) {
      this.notificationUnreadCount = Math.max(0, this.notificationUnreadCount - 1);
    }

    this.notificationService.delete(id).subscribe({
      next: (ok) => {
        if (!ok) {
          this.notifications = prev;
          this.notificationUnreadCount = prev.filter((n) => !n.read).length;
        }
      },
      error: () => {
        this.notifications = prev;
        this.notificationUnreadCount = prev.filter((n) => !n.read).length;
      },
    });
  }

  notificationIconType(type: string): string {
    const t = String(type || '').toLowerCase();
    if (t === 'quotation') return 'order';
    if (t === 'new_product') return 'product';
    if (['order', 'product', 'offer', 'review'].includes(t)) return t;
    return 'product';
  }

  onNotificationClick(notification: CustomerNotification): void {
    if (!notification.read) {
      this.markNotificationRead(notification.id);
    }

    const linkPath = String(notification.linkPath || '').trim();
    if (linkPath) {
      if (linkPath.startsWith('http://') || linkPath.startsWith('https://')) {
        window.open(linkPath, '_blank');
        return;
      }
      const path = linkPath.startsWith('/') ? linkPath : `/${linkPath}`;
      this.router.navigateByUrl(path);
      return;
    }

    const refType = String(notification.referenceType || '').toLowerCase();
    const refId = String(notification.referenceId || '').trim();
    if (refType === 'product' && refId) {
      this.router.navigate(['/product', refId]);
      return;
    }
    if (refType === 'store' && refId) {
      this.router.navigate(['/shop-details'], { queryParams: { store_id: refId } });
    }
  }

  notificationStoreNames(notification: CustomerNotification): string {
    const stores = notification.preview?.stores || [];
    if (!stores.length) return '';
    return stores.map((s) => s.store_name).filter(Boolean).join(', ');
  }

  notificationExtraCount(notification: CustomerNotification): number {
    const preview = notification.preview;
    if (!preview) return 0;
    const shown = preview.products?.length || 0;
    const total = Number(preview.item_count) || shown;
    return Math.max(0, total - shown);
  }

  formatNotificationTotal(notification: CustomerNotification): string {
    const preview = notification.preview;
    if (!preview || preview.total == null || Number.isNaN(Number(preview.total))) {
      return '';
    }
    const symbol = preview.currency_symbol || preview.currency_code || '';
    const amount = Number(preview.total).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${symbol}${amount}`;
  }

  /* ---------- Addresses ---------- */

  goToAddAddress(): void {
    const returnUrl = this.profileEditModalOpen
      ? '/customer-profile?section=profile&edit=1'
      : '/customer-profile?section=profile';
    this.router.navigate(['/add-address'], {
      queryParams: { returnUrl },
    });
  }

  loadAddresses(): void {
    if (!this.auth.isLoggedIn) return;
    this.addressesLoading = true;
    this.addressError = '';
    this.addressService.listAddresses().subscribe({
      next: (list) => {
        this.addresses = list;
        this.addressesLoading = false;
      },
      error: () => {
        this.addressesLoading = false;
        this.addressError = 'Could not load addresses.';
      },
    });
  }

  startEdit(addr: CustomerAddress): void {
    this.editingId = addr.address_id;
    this.addressError = '';
    this.addressSuccess = '';
    this.editForm = {
      address_type: addr.address_type || 'HOME',
      contact_name: addr.contact_name || '',
      contact_phone: addr.contact_phone || '',
      address_line1: addr.address_line1 || '',
      land_mark: addr.land_mark || '',
      city: addr.city || '',
      state_region: addr.state_region || '',
      postal_code: addr.postal_code || '',
      country_code: addr.country_code || 'MV',
      is_default: !!addr.is_default,
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.savingEdit = false;
  }

  saveEdit(): void {
    if (!this.editingId) return;
    const line1 = String(this.editForm.address_line1 || '').trim();
    const city = String(this.editForm.city || '').trim();
    if (!line1 || !city) {
      this.addressError = 'Address line and city are required.';
      return;
    }

    this.savingEdit = true;
    this.addressError = '';
    this.addressSuccess = '';

    const payload: Partial<CustomerAddressPayload> = {
      address_type: this.editForm.address_type || null,
      contact_name: String(this.editForm.contact_name || '').trim() || null,
      contact_phone: String(this.editForm.contact_phone || '').trim() || null,
      address_line1: line1,
      land_mark: String(this.editForm.land_mark || '').trim() || null,
      city,
      state_region: String(this.editForm.state_region || '').trim() || null,
      postal_code: String(this.editForm.postal_code || '').trim() || null,
      country_code: String(this.editForm.country_code || '').trim() || null,
      is_default: !!this.editForm.is_default,
    };

    this.addressService.updateAddress(this.editingId, payload).subscribe({
      next: (result) => {
        this.savingEdit = false;
        if (!result.ok) {
          this.addressError = result.message;
          return;
        }
        this.addressSuccess = result.message || 'Address updated.';
        this.editingId = null;
        this.loadAddresses();
      },
      error: () => {
        this.savingEdit = false;
        this.addressError = 'Could not update address.';
      },
    });
  }

  setDefault(addr: CustomerAddress): void {
    if (addr.is_default) return;
    this.addressActionId = addr.address_id;
    this.addressError = '';
    this.addressSuccess = '';
    this.addressService.setDefault(addr.address_id).subscribe({
      next: (result) => {
        this.addressActionId = null;
        if (!result.ok) {
          this.addressError = result.message;
          return;
        }
        this.addressSuccess = result.message || 'Default address updated.';
        this.loadAddresses();
      },
      error: () => {
        this.addressActionId = null;
        this.addressError = 'Could not set default address.';
      },
    });
  }

  deleteAddress(addr: CustomerAddress): void {
    this.openConfirm({
      title: 'Remove address?',
      message: 'Are you sure you want to remove this address?',
      confirmLabel: 'Yes, remove',
      action: () => this.executeDeleteAddress(addr),
    });
  }

  private executeDeleteAddress(addr: CustomerAddress): void {
    this.addressActionId = addr.address_id;
    this.addressError = '';
    this.addressSuccess = '';
    this.addressService.deleteAddress(addr.address_id).subscribe({
      next: (result) => {
        this.addressActionId = null;
        if (!result.ok) {
          this.addressError = result.message;
          return;
        }
        if (this.editingId === addr.address_id) this.editingId = null;
        this.addressSuccess = result.message || 'Address removed.';
        this.addressService.invalidateCache();
        this.addressService.listAddresses().subscribe({
          next: (list) => {
            this.addresses = list;
            if (list.length === 0) {
              this.router.navigate(['/add-address'], {
                queryParams: { required: '1' },
              });
            }
          },
        });
      },
      error: () => {
        this.addressActionId = null;
        this.addressError = 'Could not delete address.';
      },
    });
  }

  openConfirm(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    action: () => void;
  }): void {
    this.confirmTitle = options.title;
    this.confirmMessage = options.message;
    this.confirmLabel = options.confirmLabel || 'Yes, delete';
    this.pendingConfirmAction = options.action;
    this.isConfirmOpen = true;
  }

  onConfirmDialogConfirmed(): void {
    const action = this.pendingConfirmAction;
    this.closeConfirmDialog();
    action?.();
  }

  closeConfirmDialog(): void {
    this.isConfirmOpen = false;
    this.pendingConfirmAction = null;
  }

  typeLabel(type?: string | null): string {
    const t = String(type || '').toUpperCase();
    if (t === 'HOME') return 'Home';
    if (t === 'WORK') return 'Work';
    if (t === 'OTHER') return 'Other';
    return type || 'Address';
  }
}
