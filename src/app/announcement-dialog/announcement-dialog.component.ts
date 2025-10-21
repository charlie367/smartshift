import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';


interface Notice {
  id: number;
  date: string;
  title: string;
  message: string;
  link?: string;
}

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, MatButtonModule],
  templateUrl: './announcement-dialog.component.html',
  styleUrl: './announcement-dialog.component.scss'
})
export class AnnouncementDialogComponent {

  // UI 會用到的公告清單（已轉成單一日期）
  notifyList: Notice[] = [];
  readIds: number[] = []; 

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.fetchNotices();
    this.markAsRead(); 
  }

  /** 從後端抓資料 */
  private fetchNotices(): void {
    this.http.get<any>('http://localhost:8080/notify/searchAll')
      .subscribe({
        next: (res) => {
          // 直接取 notifyList，如果沒有就給空陣列
          const rawList = res?.notifyList ?? [];
          this.notifyList = (rawList as any[]).map(this.mapToNotice);
          
        },
        error: (err) => {
          this.dialog.open(ErrorDialogComponent, {
            width: '280px',
            data: { message: err?.error?.message || '載入公告失敗' }
          });
          this.notifyList = [];
          
        }
      });
  }

  private markAsRead() {
    this.http.get<any>('http://localhost:8080/notify/searchAll').subscribe({
      next: (res) => {
        const ids = (res?.notifyList ?? []).map((n: any) => n.id);
        localStorage.setItem('readNotices', JSON.stringify(ids));
      }
    });
  }
  /** 後端資料 → 前端 Notice（單一日期） */
  private mapToNotice = (item: any): Notice => {
    return {
      id: item.id,
      date: item.created_date,
      title: item.title ,
      message: item.message ,
      link: item.link_url ?? '',
    };
  };

  close() {
    this.dialogRef.close();
  }




}
