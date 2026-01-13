import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() openSignin = new EventEmitter<void>();

  registerForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  close() {
    this.closeModal.emit();
  }

  onSigninClick() {
    this.close();
    this.openSignin.emit();
  }

  onRegister() {
    console.log('Register:', this.registerForm);
  }
}
