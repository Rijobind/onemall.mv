import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileCart } from './mobile-cart';

describe('MobileCart', () => {
  let component: MobileCart;
  let fixture: ComponentFixture<MobileCart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileCart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MobileCart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
