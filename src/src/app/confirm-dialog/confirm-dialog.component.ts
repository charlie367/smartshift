import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  constructor(public dialogRef: MatDialogRef<ConfirmDialogComponent>) {}

  onConfirm(): void {
    this.dialogRef.close(true);  // 回傳 true
  }

  onCancel(): void {
    this.dialogRef.close(false); // 回傳 false
  }
}
