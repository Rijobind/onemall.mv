import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Footer } from '../../../../shared/components/footer/footer';
import { Header } from '../../../../shared/components/header/header';

interface QuoteItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-quotation',
  imports: [CommonModule, RouterModule, Header, Footer],
  templateUrl: './quotation.html',
  styleUrl: './quotation.css',
})
export class Quotation implements OnInit {
  private readonly cartStorageKey = 'cart_items';

  quotation = {
    companyName: 'Govardhan Mils cargos',
    date: '23 July, 2023',
    id: '# 241041080',
    customerName: 'Himanshu Shrivastav',
    customerEmail: 'himanshu12@gmail.com',
    quotationNo: '#11317',
    from: 'DB Schenker',
    to: 'Newage Transport LTD',
    toAddress: 'Office No. 802, 8th Floor, SG Business Hub, Ahmedabad, Gujarat 380015',
    note: 'All the packaging should be in three layer of plastic wraps',
  };

  quoteItems: QuoteItem[] = [];

  readonly taxPercent = 10;
  readonly discountPercent = 14;

  ngOnInit(): void {
    const savedItems = localStorage.getItem(this.cartStorageKey);
    if (!savedItems) return;

    try {
      const parsedItems = JSON.parse(savedItems);
      if (Array.isArray(parsedItems)) {
        this.quoteItems = parsedItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
        }));
      }
    } catch {
      this.quoteItems = [];
    }
  }

  get subtotal(): number {
    return this.quoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  get taxAmount(): number {
    return (this.subtotal * this.taxPercent) / 100;
  }

  get discountAmount(): number {
    return (this.subtotal * this.discountPercent) / 100;
  }

  get total(): number {
    return this.subtotal + this.taxAmount - this.discountAmount;
  }
}
