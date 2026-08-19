import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Header } from '../../../shared/components/header/header';
import { Footer } from '../../../shared/components/footer/footer';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { AuthService } from '../../../core/services/auth.service/auth.service';
import {
  CustomerNotification,
  NotificationService,
} from '../../../core/services/notifications.service/notifications.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-item',
  imports: [CommonModule, RouterModule, Header, Footer, ConfirmDialog],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.css',
})
export class NotificationItem implements OnInit, OnDestroy {
  notifications: CustomerNotification[] = [];
  isConfirmOpen = false;
  confirmTitle = 'Delete notification?';
  confirmMessage = 'Are you sure you want to delete this notification?';
  private pendingDeleteId: string | null = null;
  unreadCount = 0;
  isLoading = true;
  loadError = '';
  private authSub: Subscription | null = null;

  constructor(
    private notificationsService: NotificationService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
      this.isLoading = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('open-signin'));
      }
      this.router.navigate(['/'], { queryParams: { login: '1' } });
      return;
    }

    this.reload();
    this.authSub = this.auth.customer$.subscribe(() => {
      if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
        this.router.navigate(['/'], { queryParams: { login: '1' } });
        return;
      }
      this.reload();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  reload(): void {
    this.loadError = '';
    if (!this.auth.isLoggedIn) {
      this.notifications = [];
      this.unreadCount = 0;
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.notificationsService.loadNotifications({ page: 1, page_size: 50 }).subscribe({
      next: (result) => {
        this.notifications = result.items;
        this.unreadCount = result.unreadCount;
        this.isLoading = false;
      },
      error: () => {
        this.notifications = [];
        this.unreadCount = 0;
        this.isLoading = false;
        this.loadError = 'Could not load notifications.';
      },
    });
  }

  markAsRead(id: string) {
    const notification = this.notifications.find((n) => n.id === id);
    if (!notification || notification.read) return;

    notification.read = true;
    this.unreadCount = Math.max(0, this.unreadCount - 1);

    this.notificationsService.markRead(id).subscribe({
      next: (ok) => {
        if (!ok) {
          notification.read = false;
          this.unreadCount += 1;
        }
      },
      error: () => {
        notification.read = false;
        this.unreadCount += 1;
      },
    });
  }

  markAllAsRead() {
    if (this.unreadCount <= 0) return;
    const prev = this.notifications.map((n) => ({ ...n }));
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.unreadCount = 0;

    this.notificationsService.markAllRead().subscribe({
      next: (ok) => {
        if (!ok) {
          this.notifications = prev;
          this.unreadCount = prev.filter((n) => !n.read).length;
        }
      },
      error: () => {
        this.notifications = prev;
        this.unreadCount = prev.filter((n) => !n.read).length;
      },
    });
  }

  deleteNotification(id: string) {
    this.pendingDeleteId = id;
    this.confirmTitle = 'Delete notification?';
    this.confirmMessage = 'Are you sure you want to delete this notification?';
    this.isConfirmOpen = true;
  }

  onConfirmDeleteNotification(): void {
    const id = this.pendingDeleteId;
    this.closeConfirm();
    if (!id) return;

    const prev = [...this.notifications];
    const target = this.notifications.find((n) => n.id === id);
    this.notifications = this.notifications.filter((n) => n.id !== id);
    if (target && !target.read) {
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }

    this.notificationsService.delete(id).subscribe({
      next: (ok) => {
        if (!ok) {
          this.notifications = prev;
          this.unreadCount = prev.filter((n) => !n.read).length;
        }
      },
      error: () => {
        this.notifications = prev;
        this.unreadCount = prev.filter((n) => !n.read).length;
      },
    });
  }

  closeConfirm(): void {
    this.isConfirmOpen = false;
    this.pendingDeleteId = null;
  }

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  iconType(type: string): string {
    const t = String(type || '').toLowerCase();
    if (t === 'quotation') return 'order';
    if (t === 'new_product') return 'product';
    if (['order', 'product', 'offer', 'review'].includes(t)) return t;
    return 'product';
  }

  onNotificationClick(notification: CustomerNotification): void {
    if (!notification.read) {
      this.markAsRead(notification.id);
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

  storeNames(notification: CustomerNotification): string {
    const stores = notification.preview?.stores || [];
    if (!stores.length) return '';
    return stores.map((s) => s.store_name).filter(Boolean).join(', ');
  }

  extraProductCount(notification: CustomerNotification): number {
    const preview = notification.preview;
    if (!preview) return 0;
    const shown = preview.products?.length || 0;
    const total = Number(preview.item_count) || shown;
    return Math.max(0, total - shown);
  }

  formatPreviewTotal(notification: CustomerNotification): string {
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
}
