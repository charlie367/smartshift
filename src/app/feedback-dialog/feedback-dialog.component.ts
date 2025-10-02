import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'app-feedback-dialog',
  imports: [FormsModule, MatDialogModule],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.scss'
})
export class FeedbackDialogComponent {

  
  // 三個欄位：員工編號 / 標題 / 訊息內容
  form = { employeeId: '', title: '', message: '' };
  loading = false;

  constructor(
    private dialogRef: MatDialogRef<FeedbackDialogComponent>,
    private dialog: MatDialog,
    private http: HttpClient
  ) {
    // 若你平常把員工編號放在 localStorage，可自動帶入
    const id = localStorage.getItem('employeeId');
    if (id) this.form.employeeId = id;
  }

  // yyyy-MM-dd（對應後端 LocalDate）
  private today(): string {
    const n = new Date(), p = (x:number)=> String(x).padStart(2,'0');
    return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
  }

  // 最基本的前端檢核
  formOk(): boolean {
    return !!this.form.employeeId?.trim()
        && !!this.form.title?.trim()
        && !!this.form.message?.trim();
  }

  private buildPayload() {
    return {
      employeeId: this.form.employeeId.trim(), // 後端是 String，直接丟字串即可
      title: this.form.title.trim(),
      message: this.form.message.trim(),
      createdDate: this.today()
    };
  }

  sendComment() {
    if (this.loading || !this.formOk()) return;

    const confirmRef = this.dialog.open(ConfirmDialogComponent, { width: '400px' });
    confirmRef.afterClosed().subscribe(ok => {
      if (!ok) return;

      this.loading = true;
      const body = this.buildPayload();

      this.http.post('http://localhost:8080/opinion/create', body)
        .subscribe({
          next: (res: any) => {
            this.loading = false;
            this.dialogRef.close(body); // 可回傳剛送出的資料給父元件
            this.dialog.open(SuccessDialogComponent, {
              width: '300px',
              data: { title: '送出成功', message: res?.message || '新增意見成功' }
            });
          },
          error: (err) => {
            this.loading = false;
            this.dialog.open(SuccessDialogComponent, {
              width: '340px',
              data: { title: '送出失敗', message: err?.error?.message || err?.error || err.message }
            });
          }
        });
    });
  }

  onClose() { this.dialogRef.close(); }
}


