import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service/auth.service';
import { CartService } from './core/services/cart.service/cart.service';
import { AddressService } from './core/services/address.service/address.service';
import { FavoritesService } from './core/services/favorites.service/favorites.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  constructor(
    private auth: AuthService,
    private cart: CartService,
    private addresses: AddressService,
    private favorites: FavoritesService
  ) {}

  ngOnInit(): void {
    // Silent session restore — never calls request_otp.
    // After restore, load server cart + favorites (guest merge only on auth-login).
    this.auth.restoreSession().subscribe((ok) => {
      if (ok) {
        this.cart.loadFromServer().subscribe();
        this.favorites.loadFromServer().subscribe();
        this.addresses.checkAfterSessionRestore();
      } else if (this.auth.isLoggedIn) {
        // Access token still present (restore skipped / no refresh token).
        this.favorites.loadFromServer().subscribe();
      }
    });
  }
}
