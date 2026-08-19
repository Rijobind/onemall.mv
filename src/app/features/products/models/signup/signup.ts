import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service/auth.service';

type SignupStep = 'register' | 'otp';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup implements OnChanges, OnDestroy {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() openSignin = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  step: SignupStep = 'register';
  loading = false;
  errorMessage = '';
  infoMessage = '';
  otpDev = '';
  resendSeconds = 0;

  form = {
    full_name: '',
    email: '',
    country_code: '+960',
    phone_number: '',
    otp: '',
  };

  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor(public auth: AuthService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetState(false);
    }
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  close() {
    this.resetState(true);
    this.closeModal.emit();
  }

  onSigninClick() {
    this.close();
    this.openSignin.emit();
  }

  onPhoneDigitsInput(value: string) {
    this.form.phone_number = this.auth.normalizePhoneDigits(value);
  }

  onOtpInput(value: string) {
    this.form.otp = this.auth.normalizePhoneDigits(value).slice(0, 6);
    if (this.form.otp.length === 6 && !this.loading) {
      this.onVerifyOtp();
    }
  }

  onRegister() {
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';

    const payload = {
      full_name: this.form.full_name.trim(),
      email: this.form.email.trim(),
      country_code: this.auth.normalizeCountryCode(this.form.country_code),
      phone_number: this.auth.normalizePhoneDigits(this.form.phone_number),
    };

    if (!payload.full_name || !payload.email || !payload.country_code || !payload.phone_number) {
      this.errorMessage = 'Full name, email, and phone are required.';
      return;
    }

    this.loading = true;
    this.auth.registerCustomer(payload).subscribe({
      next: () => {
        this.form.country_code = payload.country_code;
        this.form.phone_number = payload.phone_number;
        this.requestOtpAfterRegister();
      },
      error: (err) => {
        this.loading = false;
        const message = String(err?.message || '').toLowerCase();
        // Already registered → go request OTP with same phone
        if (
          err?.status === 409 ||
          message.includes('already') ||
          message.includes('exist')
        ) {
          this.requestOtpAfterRegister();
          return;
        }
        this.errorMessage =
          `[${err?.source || 'UNKNOWN'}] ` + (err?.message || 'Registration failed.');
      },
    });
  }

  onVerifyOtp() {
    this.errorMessage = '';
    const otp = this.auth.normalizePhoneDigits(this.form.otp);
    if (otp.length !== 6) {
      this.errorMessage = 'Enter the 6-digit OTP.';
      return;
    }

    this.loading = true;
    this.auth
      .verifyOtp({
        country_code: this.auth.normalizeCountryCode(this.form.country_code),
        phone_number: this.auth.normalizePhoneDigits(this.form.phone_number),
        otp,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.loggedIn.emit();
          this.close();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.message || 'Invalid OTP.';
        },
      });
  }

  onResendOtp() {
    if (this.resendSeconds > 0 || this.loading) return;
    this.requestOtpAfterRegister();
  }

  backToRegister() {
    this.step = 'register';
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';
    this.form.otp = '';
    this.clearResendTimer();
  }

  get maskedPhone(): string {
    return `${this.form.country_code} ${this.form.phone_number}`.trim();
  }

  private requestOtpAfterRegister() {
    this.loading = true;
    this.errorMessage = '';
    this.auth
      .requestOtp({
        country_code: this.auth.normalizeCountryCode(this.form.country_code),
        phone_number: this.auth.normalizePhoneDigits(this.form.phone_number),
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.infoMessage = res.message || 'OTP sent';
          this.otpDev = res.otp_dev || '';
          this.step = 'otp';
          this.form.otp = '';
          this.startResendTimer(45);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage =
            `[${err?.source || 'UNKNOWN'}] ` + (err?.message || 'Failed to send OTP.');
        },
      });
  }

  private startResendTimer(seconds: number) {
    this.clearResendTimer();
    this.resendSeconds = seconds;
    this.resendTimer = setInterval(() => {
      this.resendSeconds -= 1;
      if (this.resendSeconds <= 0) {
        this.clearResendTimer();
        this.resendSeconds = 0;
      }
    }, 1000);
  }

  private clearResendTimer() {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private resetState(clearForm: boolean) {
    this.step = 'register';
    this.loading = false;
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';
    this.clearResendTimer();
    this.resendSeconds = 0;
    if (clearForm) {
      this.form = {
        full_name: '',
        email: '',
        country_code: '+960',
        phone_number: '',
        otp: '',
      };
    }
  }
}
