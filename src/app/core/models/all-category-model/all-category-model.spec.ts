import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AllCategoryModel } from './all-category-model';

describe('AllCategoryModel', () => {
  let component: AllCategoryModel;
  let fixture: ComponentFixture<AllCategoryModel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllCategoryModel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AllCategoryModel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
