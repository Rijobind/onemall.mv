import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signin',
  imports: [CommonModule, FormsModule],
  templateUrl: './signin.html',
  styleUrl: './signin.css',
})
export class Signin {
  @Input() isOpen: boolean = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() openSignup = new EventEmitter<void>();
  
  loginForm = {
    email: '',
    password: ''
  };

  close() {
    this.closeModal.emit();
  }

  onSignupClick() {
    this.close();
    this.openSignup.emit();
  }

  onLogin() {
    console.log('Login:', this.loginForm);
  }
}
