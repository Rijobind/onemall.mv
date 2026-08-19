import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ModalStep = 'menu' | 'crop';

@Component({
  selector: 'app-profile-image-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-image-modal.html',
  styleUrl: './profile-image-modal.css',
})
export class ProfileImageModal implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() hasImage = false;
  @Input() previewUrl: string | null = null;
  @Input() initials = '?';
  @Input() uploading = false;
  @Input() removing = false;
  @Input() errorMessage = '';

  @Output() closed = new EventEmitter<void>();
  @Output() cropped = new EventEmitter<File>();
  @Output() removeRequested = new EventEmitter<void>();

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  step: ModalStep = 'menu';
  imageUrl: string | null = null;
  naturalW = 0;
  naturalH = 0;

  /** Image top-left in stage coords */
  offsetX = 0;
  offsetY = 0;
  /** Scale relative to cover-fit base */
  zoom = 1;
  minZoom = 1;
  maxZoom = 3;
  baseScale = 1;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private objectUrl: string | null = null;

  readonly cropSize = 280;
  readonly outputSize = 512;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.resetToMenu();
      } else {
        this.cleanupImage();
      }
    }
  }

  ngOnDestroy(): void {
    this.cleanupImage();
  }

  get displayWidth(): number {
    return this.naturalW * this.baseScale * this.zoom;
  }

  get displayHeight(): number {
    return this.naturalH * this.baseScale * this.zoom;
  }

  get imageTransform(): string {
    return `translate(${this.offsetX}px, ${this.offsetY}px)`;
  }

  close(): void {
    if (this.uploading || this.removing) return;
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  choosePhoto(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const type = String(file.type || '').toLowerCase();
    const ok =
      type === 'image/jpeg' ||
      type === 'image/png' ||
      type === 'image/webp' ||
      /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!ok || file.size > 5 * 1024 * 1024) {
      return;
    }

    this.cleanupImage();
    this.objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      this.naturalW = img.naturalWidth;
      this.naturalH = img.naturalHeight;
      this.imageUrl = this.objectUrl;
      this.step = 'crop';
      this.fitImage();
      this.cdr.markForCheck();
    };
    img.onerror = () => {
      this.cleanupImage();
      this.cdr.markForCheck();
    };
    img.src = this.objectUrl;
  }

  backToMenu(): void {
    if (this.uploading) return;
    this.cleanupImage();
    this.step = 'menu';
  }

  requestRemove(): void {
    if (!this.hasImage || this.uploading || this.removing) return;
    this.removeRequested.emit();
  }

  onPointerDown(event: PointerEvent): void {
    if (this.step !== 'crop' || this.uploading) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.offsetX += dx;
    this.offsetY += dy;
    this.clampOffsets();
  }

  onPointerUp(event: PointerEvent): void {
    this.dragging = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
  }

  onTouchStart(event: TouchEvent): void {
    if (this.step !== 'crop' || event.touches.length !== 2) return;
    event.preventDefault();
    this.dragging = false;
    this.pinchStartDist = this.touchDistance(event.touches);
    this.pinchStartZoom = this.zoom;
  }

  onTouchMove(event: TouchEvent): void {
    if (this.step !== 'crop' || event.touches.length !== 2) return;
    event.preventDefault();
    const dist = this.touchDistance(event.touches);
    if (this.pinchStartDist <= 0) return;
    const next = this.pinchStartZoom * (dist / this.pinchStartDist);
    this.setZoom(next);
  }

  onZoomInput(value: number | string): void {
    this.setZoom(Number(value));
  }

  async confirmCrop(): Promise<void> {
    if (!this.imageUrl || this.uploading || !this.naturalW || !this.naturalH) return;

    const scale = this.baseScale * this.zoom;
    const crop = this.cropSize;
    // Source rect in natural image pixels
    const sx = (0 - this.offsetX) / scale;
    const sy = (0 - this.offsetY) / scale;
    const sSize = crop / scale;

    const canvas = document.createElement('canvas');
    canvas.width = this.outputSize;
    canvas.height = this.outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = this.imageUrl!;
    });

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.outputSize, this.outputSize);
    ctx.drawImage(
      img,
      sx,
      sy,
      sSize,
      sSize,
      0,
      0,
      this.outputSize,
      this.outputSize
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!blob) return;

    const file = new File([blob], `profile-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    this.cropped.emit(file);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isOpen) return;
    if (this.step === 'crop') {
      this.backToMenu();
    } else {
      this.close();
    }
  }

  private fitImage(): void {
    const crop = this.cropSize;
    // Cover the square: shortest side fills crop
    this.baseScale = Math.max(crop / this.naturalW, crop / this.naturalH);
    this.zoom = 1;
    this.minZoom = 1;
    this.maxZoom = 3;
    const dw = this.displayWidth;
    const dh = this.displayHeight;
    this.offsetX = (crop - dw) / 2;
    this.offsetY = (crop - dh) / 2;
    this.clampOffsets();
  }

  private setZoom(value: number): void {
    const crop = this.cropSize;
    const prevW = this.displayWidth;
    const prevH = this.displayHeight;
    const cx = crop / 2;
    const cy = crop / 2;
    const relX = (cx - this.offsetX) / (prevW || 1);
    const relY = (cy - this.offsetY) / (prevH || 1);

    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, value));

    const nextW = this.displayWidth;
    const nextH = this.displayHeight;
    this.offsetX = cx - relX * nextW;
    this.offsetY = cy - relY * nextH;
    this.clampOffsets();
  }

  private clampOffsets(): void {
    const crop = this.cropSize;
    const dw = this.displayWidth;
    const dh = this.displayHeight;
    // Image must always cover the square
    const minX = crop - dw;
    const minY = crop - dh;
    this.offsetX = Math.min(0, Math.max(minX, this.offsetX));
    this.offsetY = Math.min(0, Math.max(minY, this.offsetY));
  }

  private touchDistance(touches: TouchList): number {
    const a = touches[0];
    const b = touches[1];
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  private resetToMenu(): void {
    this.cleanupImage();
    this.step = 'menu';
    this.dragging = false;
  }

  private cleanupImage(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.imageUrl = null;
    this.naturalW = 0;
    this.naturalH = 0;
  }
}
