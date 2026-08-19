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

type SigninStep = 'phone' | 'register' | 'otp';

@Component({
  selector: 'app-signin',
  imports: [CommonModule, FormsModule],
  templateUrl: './signin.html',
  styleUrl: './signin.css',
})
export class Signin implements OnChanges, OnDestroy {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() openSignup = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  step: SigninStep = 'phone';
  loading = false;
  errorMessage = '';
  infoMessage = '';
  otpDev = '';
  resendSeconds = 0;

  form = {
    country_code: '+960',
    phone_number: '',
    full_name: '',
    email: '',
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

  onSignupClick() {
    this.close();
    this.openSignup.emit();
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

  onRequestOtp() {
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';

    const country_code = this.auth.normalizeCountryCode(this.form.country_code);
    const phone_number = this.auth.normalizePhoneDigits(this.form.phone_number);

    if (!country_code || !phone_number) {
      this.errorMessage = 'Enter your country code and phone number.';
      return;
    }

    this.loading = true;
    this.auth.requestOtp({ country_code, phone_number }).subscribe({
      next: (res) => {
        this.loading = false;
        this.form.country_code = country_code;
        this.form.phone_number = phone_number;
        this.infoMessage = res.message || 'OTP sent';
        this.otpDev = res.otp_dev || '';
        this.step = 'otp';
        this.form.otp = '';
        this.startResendTimer(45);
      },
      error: (err) => {
        this.loading = false;
        const status = err?.status;
        const message = String(err?.message || '').toLowerCase();
        const needsRegister =
          status === 404 ||
          message.includes('register') ||
          message.includes('not found') ||
          message.includes('does not exist');

        if (needsRegister) {
          this.step = 'register';
          this.errorMessage = err?.message || 'Please register first.';
          return;
        }

        this.errorMessage =
          `[${err?.source || 'UNKNOWN'}] ` +
          (err?.message ||
            (err?.source === 'NETWORK'
              ? 'Cannot reach server. Is the backend running?'
              : 'Failed to send OTP.'));
      },
    });
  }

  onRegisterThenOtp() {
    this.errorMessage = '';
    this.infoMessage = '';

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
        this.auth.requestOtp({
          country_code: payload.country_code,
          phone_number: payload.phone_number,
        }).subscribe({
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
            this.errorMessage = err?.message || 'Registered, but failed to send OTP.';
          },
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.message || 'Registration failed.';
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
    this.onRequestOtp();
  }

  backToPhone() {
    this.step = 'phone';
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';
    this.form.otp = '';
    this.clearResendTimer();
  }

  get maskedPhone(): string {
    return `${this.form.country_code} ${this.form.phone_number}`.trim();
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
    this.step = 'phone';
    this.loading = false;
    this.errorMessage = '';
    this.infoMessage = '';
    this.otpDev = '';
    this.clearResendTimer();
    this.resendSeconds = 0;
    if (clearForm) {
      this.form = {
        country_code: '+960',
        phone_number: '',
        full_name: '',
        email: '',
        otp: '',
      };
    }
  }
}
