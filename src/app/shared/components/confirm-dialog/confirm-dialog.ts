import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  imports: [CommonModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  @Input() isOpen = false;
  @Input() title = 'Are you sure?';
  @Input() message = 'This action cannot be undone.';
  @Input() confirmLabel = 'Yes, delete';
  @Input() cancelLabel = 'Cancel';
  /** danger = red destructive action; primary = green brand action */
  @Input() confirmVariant: 'danger' | 'primary' = 'danger';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  onBackdropClick(): void {
    this.cancel();
  }

  cancel(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    this.confirmed.emit();
  }
}
