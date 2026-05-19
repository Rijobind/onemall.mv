import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Quotation } from './quotation';

describe('Quotation', () => {
  let component: Quotation;
  let fixture: ComponentFixture<Quotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Quotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Quotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
