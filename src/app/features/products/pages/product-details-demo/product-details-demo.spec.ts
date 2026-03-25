import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductDetailsDemo } from './product-details-demo';

describe('ProductDetailsDemo', () => {
  let component: ProductDetailsDemo;
  let fixture: ComponentFixture<ProductDetailsDemo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailsDemo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductDetailsDemo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
