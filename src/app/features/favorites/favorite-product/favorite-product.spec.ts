import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FavoriteProduct } from './favorite-product';

describe('FavoriteProduct', () => {
  let component: FavoriteProduct;
  let fixture: ComponentFixture<FavoriteProduct>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoriteProduct]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FavoriteProduct);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
