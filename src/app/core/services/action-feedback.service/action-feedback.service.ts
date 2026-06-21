import { Injectable } from '@angular/core';

export type ActionFeedbackType = 'cart' | 'favorite';

export interface ActionFeedbackOptions {
  showToast?: boolean;
  added?: boolean;
  image?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ActionFeedbackService {
  feedback(
    event: Event | MouseEvent | undefined,
    type: ActionFeedbackType,
    options?: ActionFeedbackOptions
  ): void {
    const source = event?.currentTarget;
    if (!(source instanceof HTMLElement)) return;

    if (type === 'favorite' && options?.added === false) {
      this.pulseElement(source, type, false);
      return;
    }

    this.flyToHeader(source, type);
  }

  pulseElement(
    element: HTMLElement,
    type: ActionFeedbackType,
    added?: boolean
  ): void {
    const className =
      type === 'cart'
        ? 'action-cart-pop'
        : added === false
          ? 'action-favorite-out'
          : 'action-favorite-pop';

    element.classList.remove('action-cart-pop', 'action-favorite-pop', 'action-favorite-out');
    void element.offsetWidth;
    element.classList.add(className);

    const onEnd = () => {
      element.classList.remove(className);
      element.removeEventListener('animationend', onEnd);
    };
    element.addEventListener('animationend', onEnd);
  }

  private flyToHeader(source: HTMLElement, type: ActionFeedbackType): void {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.pulseElement(source, type);
      const target = this.getHeaderTarget(type);
      if (target) this.landOnHeader(target);
      return;
    }

    const target = this.getHeaderTarget(type);
    if (!target) {
      this.pulseElement(source, type);
      return;
    }

    this.pulseElement(source, type);

    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const size = 44;

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const controlX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - Math.max(90, Math.abs(startY - endY) * 0.35);

    const flyer = document.createElement('div');
    flyer.className = `action-fly-particle action-fly-particle-${type}`;
    flyer.setAttribute('aria-hidden', 'true');
    flyer.innerHTML = this.getFlyerIconMarkup(type);

    document.body.appendChild(flyer);

    const keyframes: Keyframe[] = [];
    const steps = 24;

    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const eased = this.easeInOutCubic(t);
      const x = this.quadraticPoint(startX, controlX, endX, eased);
      const y = this.quadraticPoint(startY, controlY, endY, eased);
      const scale = 1 - eased * 0.72;
      const opacity = 1 - eased * 0.35;

      keyframes.push({
        transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale})`,
        opacity,
        offset: t,
      });
    }

    const animation = flyer.animate(keyframes, {
      duration: 680,
      easing: 'linear',
      fill: 'forwards',
    });

    animation.onfinish = () => {
      flyer.remove();
      this.landOnHeader(target);
    };

    animation.oncancel = () => {
      flyer.remove();
    };
  }

  private landOnHeader(target: HTMLElement): void {
    target.classList.remove('header-fly-landing');
    void target.offsetWidth;
    target.classList.add('header-fly-landing');

    const onEnd = () => {
      target.classList.remove('header-fly-landing');
      target.removeEventListener('animationend', onEnd);
    };
    target.addEventListener('animationend', onEnd);
  }

  private getHeaderTarget(type: ActionFeedbackType): HTMLElement | null {
    const selector =
      type === 'cart' ? '[data-fly-target="cart"]' : '[data-fly-target="favorite"]';
    const targets = Array.from(document.querySelectorAll(selector));

    for (const node of targets) {
      if (node instanceof HTMLElement && this.isElementVisible(node)) {
        return node;
      }
    }

    const fallback = targets[0];
    return fallback instanceof HTMLElement ? fallback : null;
  }

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  private quadraticPoint(start: number, control: number, end: number, t: number): number {
    const inverse = 1 - t;
    return inverse * inverse * start + 2 * inverse * t * control + t * t * end;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private getFlyerIconMarkup(type: ActionFeedbackType): string {
    if (type === 'cart') {
      return `<span class="action-fly-particle-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17" />
        </svg>
      </span>`;
    }

    return `<span class="action-fly-particle-icon">
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </span>`;
  }
}
