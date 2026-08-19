import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Header } from '../../../shared/components/header/header';
import { Footer } from '../../../shared/components/footer/footer';
import { AuthService } from '../../../core/services/auth.service/auth.service';
import {
  AddressService,
  CustomerAddressPayload,
} from '../../../core/services/address.service/address.service';

@Component({
  selector: 'app-add-address',
  imports: [CommonModule, FormsModule, RouterModule, Header, Footer],
  templateUrl: './add-address.html',
  styleUrl: './add-address.css',
})
export class AddAddress implements OnInit, OnDestroy {
  required = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  form: CustomerAddressPayload = {
    address_type: 'HOME',
    contact_name: '',
    contact_phone: '',
    address_line1: '',
    land_mark: '',
    city: '',
    state_region: '',
    postal_code: '',
    country_code: 'MV',
    is_default: true,
  };

  readonly addressTypes = [
    { value: 'HOME', label: 'Home' },
    { value: 'WORK', label: 'Work' },
    { value: 'OTHER', label: 'Other' },
  ];

  private authSub: Subscription | null = null;
  private querySub: Subscription | null = null;

  constructor(
    private auth: AuthService,
    private addresses: AddressService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.required = params.get('required') === '1';
    });

    this.authSub = this.auth.customer$.subscribe((customer) => {
      if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
        this.router.navigate(['/'], { queryParams: { login: '1' } });
        return;
      }
      if (customer) {
        if (!this.form.contact_name) {
          this.form.contact_name = this.addresses.profileContactName();
        }
        if (!this.form.contact_phone) {
          this.form.contact_phone = this.addresses.profileContactPhone();
        }
        if (!this.form.country_code && customer.country_code) {
          // Prefer ISO country when available; dial codes are not ISO.
          const dial = String(customer.country_code || '');
          if (dial === '+960') this.form.country_code = 'MV';
        }
      }
    });

    if (!this.auth.isLoggedIn && !this.auth.hasSavedSession) {
      this.router.navigate(['/'], { queryParams: { login: '1' } });
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const line1 = String(this.form.address_line1 || '').trim();
    const city = String(this.form.city || '').trim();
    if (!line1 || !city) {
      this.errorMessage = 'Address line and city are required.';
      return;
    }

    const payload: CustomerAddressPayload = {
      address_type: this.form.address_type || 'HOME',
      contact_name: String(this.form.contact_name || '').trim() || null,
      contact_phone: String(this.form.contact_phone || '').trim() || null,
      address_line1: line1,
      land_mark: String(this.form.land_mark || '').trim() || null,
      city,
      state_region: String(this.form.state_region || '').trim() || null,
      postal_code: String(this.form.postal_code || '').trim() || null,
      country_code: String(this.form.country_code || '').trim() || null,
      is_default: this.form.is_default !== false,
    };

    this.saving = true;
    this.addresses.createAddress(payload).subscribe({
      next: (result) => {
        this.saving = false;
        if (!result.ok) {
          this.errorMessage = result.message || 'Could not save address.';
          return;
        }
        this.successMessage = result.message || 'Address saved.';
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        setTimeout(() => {
          if (returnUrl && returnUrl.startsWith('/')) {
            this.router.navigateByUrl(returnUrl);
          } else {
            this.router.navigate(['/']);
          }
        }, 400);
      },
      error: () => {
        this.saving = false;
        this.errorMessage = 'Could not save address. Please try again.';
      },
    });
  }
}
