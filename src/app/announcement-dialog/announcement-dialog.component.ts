import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';

type Tab = 'public' | 'personal';

interface Notice {
  id: number;
  date: string;   // yyyy-MM-dd (字串)
  title: string;
  message: string;
  link?: string;
  isPublish: boolean;
}

interface PersonalNotice {
  id: number;
  employeeId: string;
  date: string;   // yyyy-MM-dd
  title: string;
  message: string;
  link?: string;
}

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, MatButtonModule],
  templateUrl: './announcement-dialog.component.html',
  styleUrls: ['./announcement-dialog.component.scss']
})
export class AnnouncementDialogComponent implements OnInit {

  /* 分頁（新增） */
  currentTab: Tab = 'public';

  /* 公告 */
  notifyList: Notice[] = [];
  readIds: number[] = [];

  /* 個人通知（新增） */
  personalList: PersonalNotice[] = [];
  readPersonalIds: number[] = [];

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadReadIds();            // 公告已讀
    this.loadPersonalReadIds();    // 個人已讀
    this.fetchNotices();           // 公告
    this.fetchPersonalNotices();   // 個人
  }

  /* 分頁切換（新增） */
  switchTab(tab: Tab) { this.currentTab = tab; }

  /** 從 localStorage 載入已讀 ID（統一轉 number，避免 "1" !== 1） */
  private loadReadIds() {
    try {
      const raw = JSON.parse(localStorage.getItem('readNotices') || '[]');
      this.readIds = Array.isArray(raw) ? raw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n)) : [];
    } catch { this.readIds = []; }
  }

  /** 取公告清單（僅顯示已發布） */
  private fetchNotices(): void {
    this.http.get<any>('http://localhost:8080/notify/searchTrueAll').subscribe({
      next: (res) => {
        const raw = res?.notifyList ?? res?.notifylist ?? [];
        const normalized = (raw as any[]).map(this.mapToNotice);
        this.notifyList = normalized
          .filter(n => n.isPublish)
          // 用字串比較，避免 new Date() 時區誤差
          .sort((a, b) => b.date.localeCompare(a.date) || (b.id - a.id));
      },
      error: (err) => {
        console.error('載入公告失敗:', err);
        this.dialog.open(ErrorDialogComponent, {
          width: '280px',
          data: { message: err?.error?.message || '載入公告失敗' }
        });
        this.notifyList = [];
      }
    });
  }

  /** 後端 → 前端格式正規化（publish 支援 true/1/'1'） */
  private mapToNotice = (item: any): Notice => {
    const pubRaw = item.publish ?? item.is_publish ?? item.isPublish;
    const isPublish = (pubRaw === true) || (pubRaw === 1) || (pubRaw === '1');

    const dateRaw: string = item.createdDate ?? item.created_date ?? item.date ?? '';
    const date = (typeof dateRaw === 'string' ? dateRaw.slice(0, 10) : '');

    const link: string = item.linkUrl ?? item.link_url ?? item.link ?? '';

    return {
      id: Number(item.id),
      date,
      title: String(item.title ?? ''),
      message: String(item.message ?? ''),
      link: link ? String(link) : '',
      isPublish
    };
  };

  /** 單筆已讀（公告） */
  markAsRead(id: number): void {
    if (!this.readIds.includes(id)) {
      this.readIds = [...this.readIds, id];
      localStorage.setItem('readNotices', JSON.stringify(this.readIds));
    }
  }

  /** 全部已讀（公告） */
  private markAllAsRead(): void {
    const ids = this.notifyList.map(n => n.id);
    localStorage.setItem('readNotices', JSON.stringify(ids));
  }

  isRead(id: number): boolean {
    return this.readIds.includes(id);
  }

  /* -------- 個人通知（整合你朋友後端） -------- */

  private storagePersonal(empId: string) { return `readPersonalNotices_${empId}`; }

  private loadPersonalReadIds() {
    const employeeId = (localStorage.getItem('employeeId') || '').trim();
    if (!employeeId) { this.readPersonalIds = []; return; }
    try {
      const raw = JSON.parse(localStorage.getItem(this.storagePersonal(employeeId)) || '[]');
      this.readPersonalIds = Array.isArray(raw) ? raw.map((x: any) => Number(x)).filter((n: any) => Number.isFinite(n)) : [];
    } catch { this.readPersonalIds = []; }
  }

  private fetchPersonalNotices(): void {
    const employeeId = (localStorage.getItem('employeeId') || '').trim();
    if (!employeeId) { this.personalList = []; return; }

    this.http.get<any>('http://localhost:8080/get/employeeNotify', { params: { employeeId } })
      .subscribe({
        next: (res) => {
          // 相容各種包裝型式
          let raw: any[] = [];
          const maybeArray =
            res?.employeeNotifyList ?? res?.employee_notify_list ??
            res?.list ?? res?.data ?? res?.employeeNotifyResList;

          if (Array.isArray(maybeArray)) raw = maybeArray;
          else if (res && typeof res === 'object') raw = [res?.employeeNotify ?? res?.employee_notify ?? res];

          const normalized = raw.filter(Boolean).map(this.mapToPersonalNotice);
          this.personalList = normalized.sort((a, b) => b.date.localeCompare(a.date) || (b.id - a.id));
        },
        error: (err) => {
          console.error('載入個人通知失敗:', err);
          this.personalList = [];
        }
      });
  }

  private mapToPersonalNotice = (item: any): PersonalNotice => {
    const employeeId = String(item.employeeId ?? item.employee_id ?? '');
    const dateRaw: string = item.createdDate ?? item.created_date ?? '';
    const link: string = item.linkUrl ?? item.link_url ?? '';
    return {
      id: Number(item.id ?? 0),
      employeeId,
      date: typeof dateRaw === 'string' ? dateRaw.slice(0, 10) : '',
      title: String(item.title ?? ''),
      message: String(item.message ?? ''),
      link: link ? String(link) : ''
    };
  };

  markPersonalAsRead(id: number): void {
    const employeeId = (localStorage.getItem('employeeId') || '').trim();
    if (!employeeId) return;
    if (!this.readPersonalIds.includes(id)) {
      this.readPersonalIds = [...this.readPersonalIds, id];
      localStorage.setItem(this.storagePersonal(employeeId), JSON.stringify(this.readPersonalIds));
    }
  }

  isPersonalRead(id: number): boolean {
    return this.readPersonalIds.includes(id);
  }

  /* -------- 共用 -------- */
  trackById = (_: number, n: { id: number }) => n.id;

  normalizedLink(link?: string): string {
    if (!link) return '';
    const s = String(link).trim();
    return s.toLowerCase().startsWith('http') ? s : `https://${s}`;
  }

  /** 關閉 Dialog：維持你原本的「全部已讀」＋通知父層重算徽章 */
  close(): void {
    this.markAllAsRead(); // 公告
    const empId = (localStorage.getItem('employeeId') || '').trim();
    if (empId && this.personalList.length) {
      const ids = this.personalList.map(n => n.id);
      localStorage.setItem(this.storagePersonal(empId), JSON.stringify(ids));
    }
    this.dialogRef.close('markAsRead');
  }
}
