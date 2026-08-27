import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service/auth.service';

const AUTH_URL_RE =
  /\/Market_place\/(register_customer|request_otp|verify_otp|refresh_customer_token)(\?|$)/i;
const PUBLIC_ADS_RE = /\/Market_place\/ads(\/|$|\?)/i;

function isAuthEndpoint(url: string): boolean {
  return AUTH_URL_RE.test(url);
}

function isPublicAdsEndpoint(url: string): boolean {
  return PUBLIC_ADS_RE.test(url);
}

/**
 * Attaches Bearer access_token.
 * On 401: tries refresh_customer_token once, then retries the original request.
 * If refresh fails: clears session (OTP login needed).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  // Only attach customer Bearer to Market_place APIs (never Wasabi / external uploads).
  const isMarketplaceApi = /\/Market_place\//i.test(req.url);
  const skipAuth =
    !isMarketplaceApi || isAuthEndpoint(req.url) || isPublicAdsEndpoint(req.url);
  const alreadyRetried = req.headers.has('X-Auth-Retry');

  const token = auth.getAccessToken();
  const authReq =
    !skipAuth && token
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't refresh-loop on auth endpoints or already-retried requests
      if (error.status !== 401 || skipAuth || alreadyRetried) {
        if (error.status === 401 && skipAuth && /refresh_customer_token/i.test(req.url)) {
          auth.clearSession();
        }
        return throwError(() => error);
      }

      // No refresh token → clear and fail
      if (!auth.getRefreshToken()) {
        auth.clearSession();
        return throwError(() => error);
      }

      return auth.refreshSession().pipe(
        switchMap((ok) => {
          if (!ok) {
            return throwError(() => error);
          }

          const newToken = auth.getAccessToken();
          if (!newToken) {
            return throwError(() => error);
          }

          const retryReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${newToken}`,
              'X-Auth-Retry': '1',
            },
          });
          return next(retryReq);
        })
      );
    })
  );
};
