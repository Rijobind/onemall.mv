import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Header } from "../../../shared/components/header/header";
import { Footer } from "../../../shared/components/footer/footer";

@Component({
  selector: 'app-notification-item',
  imports: [CommonModule, RouterModule, Header, Footer],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.css',
})
export class NotificationItem {
  notifications = [
    {
      id: 1,
      title: 'New Order Received',
      message: 'You have received a new order #12345',
      time: '2 minutes ago',
      read: false,
      type: 'order'
    },
    {
      id: 2,
      title: 'Product Back in Stock',
      message: 'Wireless Bluetooth Earbuds Pro is now available',
      time: '1 hour ago',
      read: false,
      type: 'product'
    },
    {
      id: 3,
      title: 'Special Offer',
      message: 'Get 20% off on all electronics. Limited time only!',
      time: '3 hours ago',
      read: true,
      type: 'offer'
    },
    {
      id: 4,
      title: 'Order Shipped',
      message: 'Your order #12340 has been shipped',
      time: '1 day ago',
      read: true,
      type: 'order'
    },
    {
      id: 5,
      title: 'Price Drop Alert',
      message: 'Mechanical Gaming Keyboard price dropped by $20',
      time: '2 days ago',
      read: true,
      type: 'product'
    },
    {
      id: 6,
      title: 'Review Request',
      message: 'How was your purchase? Please leave a review',
      time: '3 days ago',
      read: true,
      type: 'review'
    }
  ];

  markAsRead(id: number) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
  }

  deleteNotification(id: number) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  get unreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }
}
