import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WaterdropComponent } from './waterdrop.component';

describe('WaterdropComponent', () => {
  let component: WaterdropComponent;
  let fixture: ComponentFixture<WaterdropComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WaterdropComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WaterdropComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
