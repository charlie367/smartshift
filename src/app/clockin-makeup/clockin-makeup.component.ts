import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/* ------- 後端回應型別 ------- */
interface ApiRes<T> {
  data: T;
  message?: string;
  code?: number;
  success?: boolean;
}

interface ClockDate {
  employeeId: string;
  workDate: string;     // yyyy-MM-dd / yyyy/MM/dd / yyyy-MM-ddTHH:mm:ss
  clockOn: string;      // HH:mm[:ss]
  clockOff?: string;    // HH:mm[:ss] | null
  restStart?: string;   // HH:mm[:ss] | null
  restEnd?: string;     // HH:mm[:ss] | null
  totalHour?: number;
  hasDouble?: boolean;
  score?: number;       // 0~5
  shiftWorkId?: number;
}

/* ------- 表單型別 ------- */
export interface ClockinMakeupForm {
  employeeId: string;
  date: string;           // yyyy-MM-dd
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  lunchStartTime?: string;
  lunchEndTime?: string;
  rating: number;         // 0~5
  description: string;
  file: File | null;
}

@Component({
  selector: 'app-clockin-makeup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './clockin-makeup.component.html',
  styleUrls: ['./clockin-makeup.component.scss'],
})
export class ClockinMakeupComponent implements OnInit {

  /* ====== 狀態 ====== */
  form: ClockinMakeupForm = {
    employeeId: '',
    date: '',
    startTime: '',
    endTime: '',
    lunchStartTime: '',
    lunchEndTime: '',
    rating: 0,
    description: '',
    file: null,
  };

  fileName = '';
  previewUrl = '';
  loading = false;
  showErrors = false;
  dragOver = false;
  today = new Date().toISOString().slice(0, 10);
  stars = [1, 2, 3, 4, 5] as const;

  errors: Partial<Record<keyof ClockinMakeupForm, string>> = {};

  /* ====== 檔案限制 ====== */
  private readonly MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOW_TYPES = [
    'application/pdf',
    'image/jpeg', 'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  /**
   * API base 設定
   * - 推薦：使用 Angular 代理，把 `/single` 代理到 `http://localhost:8080`。
   *   此時把 BASE 設成空字串 ''，實際請求路徑會是 `/single/date`。
   * - 若要直連（暫時測），把 BASE 換成 'http://localhost:8080' 也行。
   */
  private readonly API_BASE = ''; // ← 使用代理（推薦）
  // private readonly API_BASE = 'http://localhost:8080'; // ← 直連開發後端

  constructor(
    private dialogRef: MatDialogRef<ClockinMakeupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<ClockinMakeupForm>,
    private http: HttpClient
  ) {
    // 外部預填
    this.form.employeeId = (data.employeeId || '').toUpperCase();
    this.form.date = data.date || '';
  }

  ngOnInit(): void {
    // 若進來就帶有員編 + 日期 → 直接覆蓋帶入一次
    if (this.form.employeeId && this.form.date) {
      void this.prefillFromDb(this.form.employeeId, this.form.date, { override: true });
    }
  }

  /* ================= UI ================= */
  setRating(n: number) { this.form.rating = n; }
  close() { this.dialogRef.close({ ok: false }); }

  touch(_field: keyof ClockinMakeupForm) {
    this.validate();
    this.showErrors = true;
  }

  onEmpChange(value: string | null) {
    this.form.employeeId = (value ?? '').trim().toUpperCase();
    this.clearTimes();
    if (this.form.employeeId && this.form.date) {
      void this.prefillFromDb(this.form.employeeId, this.form.date);
    }
  }

  onDateChange(value: string | null) {
    this.form.date = (value ?? '').trim(); // input[type=date] → yyyy-MM-dd
    this.clearTimes();
    if (this.form.employeeId && this.form.date) {
      void this.prefillFromDb(this.form.employeeId, this.form.date);
    }
  }

  private clearTimes() {
    this.form.startTime = '';
    this.form.endTime = '';
    this.form.lunchStartTime = '';
    this.form.lunchEndTime = '';
  }

  /* ================= 檔案 ================= */
  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setFile(file);
  }
  onDragOver(e: DragEvent) { e.preventDefault(); this.dragOver = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); this.dragOver = false; }
  onDrop(e: DragEvent) {
    e.preventDefault(); this.dragOver = false;
    const f = e.dataTransfer?.files?.[0];
    if (f) this.setFile(f);
  }
  removeFile(e?: Event) {
    e?.stopPropagation();
    this.form.file = null; this.fileName = ''; this.previewUrl = ''; this.errors.file = undefined;
  }
  private setFile(file: File) {
    if (!this.ALLOW_TYPES.includes(file.type)) { this.errors.file = '不支援的檔案格式'; this.showErrors = true; return; }
    if (file.size > this.MAX_SIZE)           { this.errors.file = '檔案超過 10MB 上限'; this.showErrors = true; return; }
    this.form.file = file; this.fileName = file.name; this.errors.file = undefined;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader(); reader.onloadend = () => this.previewUrl = String(reader.result || '');
      reader.readAsDataURL(file);
    } else { this.previewUrl = ''; }
  }

  reset() {
    this.form = { employeeId: '', date: '', startTime: '', endTime: '', lunchStartTime: '', lunchEndTime: '', rating: 0, description: '', file: null };
    this.fileName = ''; this.previewUrl = ''; this.errors = {}; this.showErrors = false;
  }

  /* ================= 驗證 ================= */
  private validate(): boolean {
    const e: typeof this.errors = {};

    if (!this.form.employeeId?.trim()) e.employeeId = '員工編號為必填';
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(this.form.employeeId.trim())) e.employeeId = '格式不正確（英數/連字號 3~20 字）';

    if (!this.form.date) e.date = '日期為必填';
    else if (this.form.date > this.today) e.date = '日期不可晚於今天';

    if (!this.form.startTime) e.startTime = '開始時間為必填';
    if (!this.form.endTime)   e.endTime   = '結束時間為必填';

    const toMin = (t?: string) => t ? parseInt(t.slice(0,2))*60 + parseInt(t.slice(3,5)) : NaN;
    const s = toMin(this.form.startTime), ed = toMin(this.form.endTime);
    if (Number.isFinite(s) && Number.isFinite(ed) && s >= ed) e.endTime = '結束時間需晚於開始時間';

    const ls = toMin(this.form.lunchStartTime), le = toMin(this.form.lunchEndTime);
    const hasLs = Number.isFinite(ls), hasLe = Number.isFinite(le);
    if (hasLs !== hasLe) {
      e.lunchEndTime = '午休需成對填寫';
      e.lunchStartTime = '午休需成對填寫';
    } else if (hasLs && hasLe) {
      if (!(Number.isFinite(s) && Number.isFinite(ed))) {
        e.lunchStartTime = '請先填妥開始/結束時間';
        e.lunchEndTime = '請先填妥開始/結束時間';
      } else {
        if (ls! < s! || le! > ed!) {
          e.lunchStartTime = '午休需介於上班時間內';
          e.lunchEndTime = '午休需介於上班時間內';
        }
        if (ls! >= le!) e.lunchEndTime = '午休結束需晚於開始';
      }
    }

    const desc = (this.form.description || '').trim();
    if (!desc) e.description = '請填寫原因說明';
    else if (desc.length < 10) e.description = '請至少輸入 10 個字';

    this.errors = e;
    return Object.keys(e).length === 0;
  }

  /* ================= 呼叫後端，帶入打卡紀錄 ================= */

  // 正規化：日期→yyyy-MM-dd
  private normDate(s?: string | null): string {
    if (!s) return '';
    const head = String(s).split('T')[0].trim();
    return head.replace(/[./]/g, '-');
  }
  // 正規化：時間→HH:mm
  private normTime(s?: string | null): string {
    if (!s) return '';
    const [h = '00', m = '00'] = String(s).split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  private normEmp(s: string) { return (s || '').trim().toUpperCase(); }

  private async tryGet<T>(url: string, params?: Record<string,string>): Promise<T | null> {
    try {
      const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
      return await firstValueFrom(this.http.get<T>(url, { params: httpParams }));
    } catch { return null; }
  }

  private async prefillFromDb(employeeId: string, ymd: string, opt: { override?: boolean } = {}) {
    const emp = this.normEmp(employeeId);
    const dateKey = this.normDate(ymd);
    if (!emp || !dateKey) return;

    this.loading = true;
    let rows: ClockDate[] = [];

    // 正確路徑：/single/date?employeeId=...&workDate=...
    const r1 = await this.tryGet<ApiRes<ClockDate[]>>(
      `${this.API_BASE}/single/date`,
      { employeeId: emp, workDate: dateKey }
    );
    if (r1?.data?.length) rows = r1.data;

    if (rows.length) {
      this.applyClockRows(rows, !!opt.override);
      this.validate();
    } else if (opt.override) {
      this.clearTimes();
      this.form.rating = 0;
    }

    this.loading = false;
  }

  /** 取最早上班、最晚上班；override=true 直接覆蓋，false 只填空欄位 */
  private applyClockRows(rows: ClockDate[], override = false) {
    const onAsc  = [...rows].sort((a,b)=> (a.clockOn||'').localeCompare(b.clockOn||''));
    const offAsc = [...rows].filter(x=> !!x.clockOff)
                            .sort((a,b)=> (a.clockOff||'').localeCompare(b.clockOff||''));

    const first = onAsc[0];
    const last  = offAsc.length ? offAsc[offAsc.length - 1] : onAsc[0];

    const v = {
      start: this.normTime(first?.clockOn),
      end:   this.normTime(last?.clockOff),
      ls:    this.normTime(first?.restStart),
      le:    this.normTime(first?.restEnd),
      rate:  (first?.score ?? 0)
    };

    if (override || !this.form.startTime)      this.form.startTime      = v.start;
    if (override || !this.form.endTime)        this.form.endTime        = v.end;
    if (override || !this.form.lunchStartTime) this.form.lunchStartTime = v.ls;
    if (override || !this.form.lunchEndTime)   this.form.lunchEndTime   = v.le;
    if (override || !this.form.rating)         this.form.rating         = v.rate;
  }

  /* ================= 送出 ================= */
  async submit() {
    this.showErrors = true;
    if (!this.validate()) return;

    this.loading = true;
    try {
      const fd = new FormData();
      fd.append('employeeId', this.form.employeeId.trim());
      fd.append('date', this.form.date);
      fd.append('startTime', this.form.startTime);
      fd.append('endTime', this.form.endTime);
      if (this.form.lunchStartTime) fd.append('lunchStartTime', this.form.lunchStartTime);
      if (this.form.lunchEndTime)   fd.append('lunchEndTime', this.form.lunchEndTime);
      fd.append('rating', String(this.form.rating));
      fd.append('description', this.form.description.trim());
      if (this.form.file) fd.append('file', this.form.file);

      await firstValueFrom(this.http.post<{ id: string; message?: string }>(
        // 這支是你原本的申請提交 API，維持不變（自行接到後端）
        '/api/clockin-makeup', fd
      ));

      this.dialogRef.close({ ok: true, message: '補打卡申請已送出！' });
    } catch (err: any) {
      alert(err?.error?.message ?? '送出失敗，請稍後再試');
    } finally {
      this.loading = false;
    }
  }
}
