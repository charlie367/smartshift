import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';


@Component({
  selector: 'app-feedback-dialog',
  imports: [FormsModule, MatDialogModule],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.scss'
})
export class FeedbackDialogComponent {

  
  userComment = {
    name: '',
    email: '',
    comment: ''
  };

  constructor(private dialogRef: MatDialogRef<FeedbackDialogComponent>,private dialog: MatDialog) {}

  sendComment() {
    // 開啟確認對話框
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px'
    });

    confirmRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('送出的資料:', this.userComment);

        // 關閉 feedback dialog
        this.dialogRef.close(this.userComment);

        // 再打開成功提示
        this.dialog.open(SuccessDialogComponent, {
          width: '300px'
        });
      } else {
        console.log('使用者取消送出');
      }
    });
  }

  onClose() {
    this.dialogRef.close();
  }
}

