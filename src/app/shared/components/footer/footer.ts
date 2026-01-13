import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  getHelpLinks = [
    'Delivery Information',
    'Sale Terms & Conditions',
    'Returns & Refunds',
    'Privacy Notice',
    'Shopping FAQs'
  ];

  popularCategories = [
    'Laptops & Computers',
    'Cameras & Photography',
    'Smart Phones & Tablets',
    'Video Games & Consoles',
    'TV & Audio',
    'Gadgets',
    'Waterproof Headphones'
  ];

  customerCareLinks = [
    'My Account',
    'Track your Order',
    'Customer Service',
    'Returns/Exchange',
    'FAQs',
    'Product Support'
  ];

  bottomLinks = [
    'New arrivals',
    'Best sale',
    'Value of the day',
    'Top 100 offers',
    'Blog',
    '50% OFF'
  ];
}
