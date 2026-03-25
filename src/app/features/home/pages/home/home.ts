import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../../../../shared/components/header/header';
import { Footer } from '../../../../shared/components/footer/footer';
import { Router } from '@angular/router';
import { BackendapiServices } from '../../../../core/services/backendapi.services/backendapi.services';
import { AllCategoryModel } from '../../../../core/models/all-category-model/all-category-model';

@Component({
  selector: 'app-home',
  imports: [CommonModule, Header, Footer, AllCategoryModel],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit {
  @ViewChild('recentlyViewedCarousel') recentlyViewedCarousel?: ElementRef<HTMLElement>;

  activeTab: string = 'feature';
  activeProductTab: string = 'top20';
  categories: any[] = [];
  categoryTree: any[] = [];
  allCategoryTree: any[] = []; // Full category tree for modal
  activeChildMap: Map<string, any> = new Map(); // Track active child for each parent category
  isAllCategoryModalOpen: boolean = false;
  isLoading: boolean = true;
  
  constructor(private router: Router, private api: BackendapiServices) {}

  // categories = [
  //   {
  //     name: 'Apparel',
  //     iconType: 'tshirt',
  //     submenu: ['Men', 'Women', 'Kids', 'Accessories', 'Shoes', 'Bags']
  //   },
  //   {
  //     name: 'Automotive parts',
  //     iconType: 'car',
  //     submenu: ['Engine', 'Lubricants & Fluids', 'Best sellers', 'Cooling System', 'Exhaust System', 'Battery', 'Interior']
  //   },
  //   {
  //     name: 'Beauty & personal care',
  //     iconType: 'beauty',
  //     submenu: ['Skincare', 'Makeup', 'Haircare', 'Fragrance & Deodorant', 'Body Care']
  //   },
  //   {
  //     name: 'Consumer Electronics',
  //     iconType: 'electronics',
  //     submenu: ['Smartphones', 'Laptops', 'Tablets', 'Headphones', 'Cameras', 'Gaming']
  //   },
  //   {
  //     name: 'Furniture',
  //     iconType: 'furniture',
  //     submenu: ['Living Room', 'Bedroom', 'Dining Room', 'Office', 'Outdoor', 'Storage']
  //   },
  //   {
  //     name: 'Home products',
  //     iconType: 'home',
  //     submenu: ['Kitchen', 'Bathroom', 'Bedding', 'Decor', 'Lighting', 'Storage']
  //   },
  //   {
  //     name: 'Machinery',
  //     iconType: 'machinery',
  //     submenu: ['Industrial', 'Agricultural', 'Construction', 'Manufacturing', 'Tools']
  //   },
  //   {
  //     name: 'Timepieces, jewelry & eyewear',
  //     iconType: 'jewelry',
  //     submenu: ['Watches', 'Jewelry', 'Eyewear', 'Accessories', 'Luxury']
  //   },
  //   {
  //     name: 'Tool & hardware',
  //     iconType: 'tool',
  //     submenu: ['Power Tools', 'Hand Tools', 'Hardware', 'Safety Equipment', 'Measuring Tools']
  //   },
  //   {
  //     name: 'Bestseller',
  //     iconType: 'bestseller',
  //     submenu: ['Top Rated', 'Most Popular', 'New Arrivals', 'Special Offers']
  //   },
  // ];

  ngOnInit(): void {
    this.loadCategory();
  }

  // loadCategory() {
  //   this.api.getAllCategory().subscribe((res: any) => {
  //     this.categories = res.data || [];
  //     console.log('home category ->', this.categories);
  //   });
  // }

  loadCategory() {
    this.api.getAllCategoryList().subscribe((res: any) => {
      const allCategories = res.data || [];

      // Parent categories
      const parents = allCategories.filter((cat: any) => cat.parent_id === null);

      // Build recursive tree for all categories
      const allCategoryTree = parents.map((parent: any) => this.buildCategoryTree(parent, allCategories));

      // Store full tree for modal
      this.allCategoryTree = allCategoryTree;

      // Limit to 9 categories for home page
      this.categoryTree = allCategoryTree.slice(0, 9);

      // Transform to match the expected format for home page
      this.categories = this.categoryTree.map((parent: any) => ({
        name: parent.category_name,
        iconType: this.getIconType(parent.category_name),
        submenu: this.flattenChildren(parent.children),
      }));

      console.log('Home Category Tree:', this.categoryTree);
      this.isLoading = false;
    }, () => {
      this.isLoading = false;
    });
  }

  onViewAllCategories() {
    this.isAllCategoryModalOpen = true;
  }

  onCloseAllCategoryModal() {
    this.isAllCategoryModalOpen = false;
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

  // Flatten children recursively to get all submenu items
  flattenChildren(children: any[]): string[] {
    if (!children || children.length === 0) return [];
    
    const result: string[] = [];
    children.forEach((child: any) => {
      result.push(child.category_name);
      if (child.children && child.children.length > 0) {
        result.push(...this.flattenChildren(child.children));
      }
    });
    return result;
  }

  // Map category names to icon types
  getIconType(categoryName: string): string {
    const name = categoryName.toLowerCase();

    if (name.includes('apparel') || name.includes('clothing') || name.includes('fashion') || name.includes('wear')) {
      return 'tshirt';
    } else if (name.includes('automotive') || name.includes('car') || name.includes('vehicle')) {
      return 'car';
    } else if (name.includes('beauty') || name.includes('personal care') || name.includes('cosmetic') || name.includes('health & beauty')) {
      return 'beauty';
    } else if (name.includes('electronic') || name.includes('device') || name.includes('tech') || name.includes('it')) {
      return 'electronics';
    } else if (name.includes('furniture')) {
      return 'furniture';
    } else if (name.includes('home') || name.includes('house') || name.includes('living')) {
      return 'home';
    } else if (name.includes('machinery') || name.includes('machine')) {
      return 'machinery';
    } else if (name.includes('jewelry') || name.includes('jewellery') || name.includes('watch') || name.includes('eyewear')) {
      return 'jewelry';
    } else if (name.includes('tool') || name.includes('hardware') || name.includes('improvement')) {
      return 'tool';
    } else if (name.includes('bestseller') || name.includes('best seller') || name.includes('popular')) {
      return 'bestseller';
    }

    return 'bestseller';
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

  onCategoryClick(category: any) {
    console.log('Selected category:', category);
    // Example:
    // this.router.navigate(['/shop'], {
    //   queryParams: { categoryId: category.category_id }
    // });
  }

  serviceHighlights = [
    {
      iconType: 'delivery',
      title: 'Free delivery',
      description: 'Free Shipping for orders over $20',
    },
    { iconType: 'support', title: 'Support 24/7', description: '24 hours a day, 7 days a week' },
    { iconType: 'payment', title: 'Payment', description: 'Pay with Multiple Credit Cards' },
    { iconType: 'reliable', title: 'Reliable', description: 'Trusted by 2000+ major brands' },
    { iconType: 'guarantee', title: 'Guarantee', description: 'Within 30 days for an exchange' },
  ];

  dealOfTheDay = [
    {
      id: 1,
      title: 'Smart Thermostat',
      price: 79.99,
      originalPrice: 129.99,
      discount: 20,
      image: 'https://via.placeholder.com/200',
      timeLeft: '02:15:30',
    },
    {
      id: 2,
      title: 'Digital Camera',
      price: 299.99,
      originalPrice: 399.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
      timeLeft: '05:30:45',
    },
    {
      id: 3,
      title: 'Smartphone Pro',
      price: 599.99,
      originalPrice: 799.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
      timeLeft: '01:20:15',
    },
    {
      id: 4,
      title: 'Game Controller',
      price: 49.99,
      originalPrice: 69.99,
      discount: 29,
      image: 'https://via.placeholder.com/200',
      timeLeft: '03:45:20',
    },
  ];

  featuredProducts = [
    {
      id: 1,
      title: 'Huawei P40 Pro 16GB',
      price: 699.99,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 2,
      title: 'Earphone 3.5mm Retro',
      price: 29.99,
      image: 'https://via.placeholder.com/150',
    },
    {
      id: 3,
      title: 'Apple Watch Series 5',
      price: 349.99,
      image: 'https://via.placeholder.com/150',
    },
  ];

  mainFeaturedProduct = {
    title: 'Professional Drone Camera',
    price: 103999,
    originalPrice: 129999,
    discount: 20,
    image: 'https://via.placeholder.com/400',
    thumbnails: [
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
      'https://via.placeholder.com/80',
    ],
  };

  promotionalBanners = [
    { title: 'CATCH BIG DEALS', category: 'Headphones', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Cameras', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Phones', image: 'https://via.placeholder.com/250' },
    { title: 'CATCH BIG DEALS', category: 'Watches', image: 'https://via.placeholder.com/250' },
  ];

  bestSellers = [
    { id: 1, title: 'Laptop Pro 16"', price: 1299.99, image: 'https://via.placeholder.com/200' },
    { id: 2, title: 'Smartphone X', price: 799.99, image: 'https://via.placeholder.com/200' },
    { id: 3, title: 'Portable Speaker', price: 89.99, image: 'https://via.placeholder.com/200' },
    { id: 4, title: 'USB Hub 7-in-1', price: 39.99, image: 'https://via.placeholder.com/200' },
    { id: 5, title: 'Smart Watch', price: 249.99, image: 'https://via.placeholder.com/200' },
    { id: 6, title: 'Smart Speaker', price: 99.99, image: 'https://via.placeholder.com/200' },
    { id: 7, title: 'Wireless Earbuds', price: 149.99, image: 'https://via.placeholder.com/200' },
    { id: 8, title: 'Wireless Mouse', price: 49.99, image: 'https://via.placeholder.com/200' },
  ];

  topProducts = [
    {
      id: 1,
      title: 'Wireless Headphones',
      price: 199.99,
      originalPrice: 299.99,
      discount: 33,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 2,
      title: 'Game Controller',
      price: 59.99,
      originalPrice: 79.99,
      discount: 25,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 3,
      title: 'Smartphone Ultra',
      price: 899.99,
      originalPrice: 1099.99,
      discount: 18,
      image: 'https://via.placeholder.com/200',
    },
    {
      id: 4,
      title: 'Laptop Air',
      price: 999.99,
      originalPrice: 1299.99,
      discount: 23,
      image: 'https://via.placeholder.com/200',
    },
  ];

  recentlyViewed = [
    {
      id: 1,
      name: 'Urbanears Pampas - Wireless Over-Ear Headphones with Immersive Sound...',
      category: 'Headphone',
      price: 48.99,
      image: '/shirt.jpg',
    },
    {
      id: 2,
      name: 'Upgrader Headphones - Altec Lansing by ECCO Design, Premium Sound &...',
      category: 'Headphone',
      price: 27.5,
      image: '/mobile4.jpg',
    },
    {
      id: 3,
      name: 'Apple Watch Series 6 (GPS) - 40mm Aluminum Case with Sport Band, Offic...',
      category: 'Smartwatch',
      price: 63.999,
      image: '/shoe3.jpg',
    },
    {
      id: 4,
      name: 'Lenovo Yoga 910-13IKB - 2-in-1 Ultrabook with Touchscreen & 360°...',
      category: 'Laptop & Computer',
      price: 39.99,
      image: '/glass.jpg',
    },
    {
      id: 5,
      name: 'JBL LIVE200BT - Wireless Neckband Earphones with Premium Sound &...',
      category: 'Wireless Earphones',
      price: 14.999,
      image: '/keyboard.jpg',
    },
    {
      id: 5,
      name: 'JBL LIVE200BT - Wireless Neckband Earphones with Premium Sound &...',
      category: 'Wireless Earphones',
      price: 14.999,
      image: '/shirt2.jpg',
    },
    {
      id: 5,
      name: 'JBL LIVE200BT - Wireless Neckband Earphones with Premium Sound &...',
      category: 'Wireless Earphones',
      price: 14.999,
      image: '/mobile4.jpg',
    },
    {
      id: 5,
      name: 'JBL LIVE200BT - Wireless Neckband Earphones with Premium Sound &...',
      category: 'Wireless Earphones',
      price: 14.999,
      image: '/shoe4.jpg',
    },
  ];

  products = [
    {
      title: 'iPhone 15 Pro',
      price: 999,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'MacBook Air',
      price: 1299,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'Headphones',
      price: 199,
      image: 'https://via.placeholder.com/300',
    },
    {
      title: 'Smart Watch',
      price: 249,
      image: 'https://via.placeholder.com/300',
    },
  ];

  setTab(tab: string) {
    this.activeTab = tab;
  }

  setProductTab(tab: string) {
    this.activeProductTab = tab;
  }

  scrollRecentlyViewed(direction: 'left' | 'right') {
    if (this.recentlyViewedCarousel?.nativeElement) {
      const scrollAmount = 280;
      const currentScroll = this.recentlyViewedCarousel.nativeElement.scrollLeft;
      const newScroll =
        direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount;
      this.recentlyViewedCarousel.nativeElement.scrollTo({ left: newScroll, behavior: 'smooth' });
    }
  }

  newArrivals = [
    {
      id: 1,
      name: '3Dconnexion 3DX-700040 SpaceMouse Pro 3D - Professional...',
      category: 'Electronics',
      price: 64500,
      originalPrice: 80400,
      image: '/glass.jpg',
    },
    {
      id: 2,
      name: 'Apple iPhone 11 Pro Max, 256GB, Space Gray',
      category: 'Smartphone',
      price: 34700,
      originalPrice: 42800,
      image: '/keyboard.jpg',
    },
    {
      id: 3,
      name: 'GameConsole Destiny Special Edition - Limited Edition Console Bundle fo...',
      category: 'Game Controllers',
      price: 68200,
      originalPrice: 85500,
      image: '/ps5.jpg',
    },
    {
      id: 4,
      name: 'Garmin fenix 7 Adventure Smartwatch - Rugged Outdoor GPS...',
      category: 'Smartwatch',
      price: 17100,
      originalPrice: 21700,
      image: '/air-pod.jpg',
    },
    {
      id: 5,
      name: 'Skytech Shadow Gaming PC Desktop - INTEL Core i5, 16GB RAM, 1TB HD...',
      category: 'Laptop & Computers',
      price: 61000,
      originalPrice: 76800,
      image: '/laptop.jpg',
    },
    {
      id: 6,
      name: 'Apple Watch Series 6 (GPS + Cellular, 40mm) - Space Gray...',
      category: 'Smartwatch',
      price: 35400,
      originalPrice: 43900,
      image: '/shoe3.jpg',
    },
    {
      id: 7,
      name: 'Logitech G Pro Wireless Gaming Mouse',
      category: 'Computer Accessories',
      price: 57600,
      originalPrice: 72400,
      image: '/mouse2.jpg',
    },
    {
      id: 8,
      name: 'All-new Fire 7 tablet, 7" display, 16 GB, latest model (2022 release),...',
      category: 'Tablets',
      price: 24900,
      originalPrice: 30800,
      image: '/shoe4.jpg',
    },
  ];
  newArrival = [
    {
      id: 1,
      name: '3Dconnexion 3DX-700040 SpaceMouse Pro 3D - Professional...',
      category: 'Electronics',
      price: 64500,
      originalPrice: 80400,
      image: '/shirt.jpg',
    },
    {
      id: 2,
      name: 'Apple iPhone 11 Pro Max, 256GB, Space Gray',
      category: 'Smartphone',
      price: 34700,
      originalPrice: 42800,
      image: '/shirts.jpg',
    },
    {
      id: 3,
      name: 'GameConsole Destiny Special Edition - Limited Edition Console Bundle fo...',
      category: 'Game Controllers',
      price: 68200,
      originalPrice: 85500,
      image: '/shirt2.jpg',
    },
    {
      id: 4,
      name: 'Garmin fenix 7 Adventure Smartwatch - Rugged Outdoor GPS...',
      category: 'Smartwatch',
      price: 17100,
      originalPrice: 21700,
      image: '/mobile4.jpg',
    },
  ];

  onProductDetails() {
    this.router.navigate(['product-details']);
  }
}
