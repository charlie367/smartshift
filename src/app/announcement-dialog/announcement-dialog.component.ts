import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

//
// 前端顯示用資料模型：只有一個日期 + 文字
//
interface Notice {
  id: number;
  date: string;        // yyyy-MM-dd
  text: string;
}

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, MatButtonModule],
  templateUrl: './announcement-dialog.component.html',
  styleUrl: './announcement-dialog.component.scss'
})
export class AnnouncementDialogComponent implements OnInit {

  // UI 會用到的公告清單（已轉成單一日期）
  notifyList: Notice[] = [];
  loading = false;
  errorMsg = '';

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>
  ) {}

  ngOnInit(): void {
    this.fetchNotices();
  }

  /** 從後端抓資料 */
  private fetchNotices(): void {
    this.loading = true;
    this.errorMsg = '';

    this.http.get<any>('http://localhost:8080/notify/searchAll')
      .subscribe({
        next: (res) => {
          // 後端可能回 {code, message, data: []} 或 {code, message, list: []} 或直接 []
          const rawList =
            (Array.isArray(res) ? res :
            res?.data ??
            res?.notifyList ??
            res?.list ??
            []);

          this.notifyList = (rawList as any[]).map(this.mapToNotice);
          this.loading = false;
        },
        error: (err) => {
          console.error('取得通知失敗', err);
          this.errorMsg = err?.error?.message || '載入公告失敗';
          this.notifyList = [];
          this.loading = false;
        }
      });
  }

  /** 後端資料 → 前端 Notice（單一日期） */
  private mapToNotice = (item: any): Notice => {
    // 可能的 id 欄位：notify_id / id
    const id = Number(item?.notify_id ?? item?.id ?? 0);

    // 可能的日期欄位：notify_startTime / createdDate / created_date
    const dateRaw =
      item?.notify_startTime ??
      item?.createdDate ??
      item?.created_date ??
      item?.date;

    // 可能的文字欄位：notify_text / message / title
    const text =
      item?.notify_text ??
      item?.message ??
      item?.title ??
      '';

    return {
      id,
      date: this.toYMD(dateRaw),
      text
    };
  };

  /** 轉成 yyyy-MM-dd（可吃 Date / ISO / 'yyyy/MM/dd'） */
  private toYMD(v: any): string {
    if (!v) return '';
    if (v instanceof Date) return this.fixTz(v).toISOString().slice(0, 10);

    if (typeof v === 'string') {
      // '2025-09-29T00:00:00' / '2025/09/29' / '2025-09-29'
      const s = v.includes('T') ? v.slice(0, 10) : v.replace(/\//g, '-');
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

      const tryDate = new Date(v);
      if (!isNaN(tryDate.getTime())) return this.fixTz(tryDate).toISOString().slice(0, 10);
      return '';
    }

    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : this.fixTz(d).toISOString().slice(0, 10);
  }

  /** 修正時區，避免顯示成前一天 */
  private fixTz(d: Date): Date {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  }

  /** 點擊公告（之後可打開編輯 Dialog） */
  showEditDialog(notice: Notice) {
    console.log('編輯公告', notice);
    // TODO: 打開編輯 Dialog
  }

  close() {
    this.dialogRef.close();
  }
}
