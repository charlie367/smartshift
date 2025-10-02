import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';

@Component({
  selector: 'app-leave-form',
  imports: [FormsModule],
  templateUrl: './leave-form.component.html',
  styleUrl: './leave-form.component.scss'
})
export class LeaveFormComponent {
  constructor(private router: Router, private dialog: MatDialog) {}

  ngOnInit() {
    const empId = localStorage.getItem('employeeId');
    this.leave.employeeId = empId || '';
  }

  // ---- UI 狀態 ----
  period: LeavePeriod[] = [];
  previewUrl: string | null = null;
  leaveProveBase64: string[] = [];

  // 表單模型
  leave = {
    employeeId: '',
    leaveType: '',
    leaveDescription: '',
    totalHours: '',
    leaveProve: '',
    leavePeriod: this.period
  };

  // ========== 事件 ==========
  addPeriod() {
    this.period.push({ leave: '', startTime: '', endTime: '' });
  }

  deletePeriod(index: number) {
    this.period.splice(index, 1);
  }

  sendJSON1() {
    this.router.navigate(['/scheduling']);
  }

  private openError(message: string) {
    this.dialog.open(ErrorDialogComponent, {
      width: '320px',
      data: { message, autoCloseMs: 8000 },
      panelClass: 'error-dialog-panel'
    });
  }

  // 送出申請（必須整個班別＋當天要上班且已核准）
  sendJSON() {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, { width: '400px' });

    confirmRef.afterClosed().subscribe(async (ok) => {
      if (!ok) return;

      const errs: string[] = [];

      // 基本欄位
      if (!this.leave.employeeId) errs.push('找不到員工編號（請重新登入）');
      if (!this.leave.leaveType) errs.push('請選擇假別');
      if (!this.leave.leaveDescription) errs.push('請填寫請假事由');
      if (!this.period.length) errs.push('至少新增一個請假時間段');

      // 格式與重覆日期檢查
      const seenDate = new Set<string>();
      for (let i = 0; i < this.period.length; i++) {
        const p = this.period[i];
        if (!p.leave || !p.startTime || !p.endTime) {
          errs.push(`第 ${i + 1} 段：日期/開始/結束 必填`);
          continue;
        }
        if (this.timeToMinutes(p.endTime) <= this.timeToMinutes(p.startTime)) {
          errs.push(`第 ${i + 1} 段：結束時間需晚於開始時間`);
        }
        if (seenDate.has(p.leave)) {
          errs.push(`第 ${i + 1} 段：同一天只能申請一段（${p.leave} 重複）`);
        } else {
          seenDate.add(p.leave);
        }
      }

      if (errs.length) {
        this.openError('無法送出：\n' + errs.join('\n'));
        return;
      }

      // 逐段打 API 檢查「是否上班、是否核准、是否整個班別」
      for (let i = 0; i < this.period.length; i++) {
        const p = this.period[i];
        try {
          const sch = await this.fetchScheduleByEmployeeAndDate(this.leave.employeeId, p.leave);
          if (!sch) {
            errs.push(`第 ${i + 1} 段：${p.leave} 沒有班表，無法申請`);
            continue;
          }

          // ← 改用 working / accept（若後端還回 isWorking/isAccept，fetch 內已做轉換）
          if (!sch.working) {
            errs.push(`第 ${i + 1} 段：${p.leave} 非上班日，無法申請`);
          }
          if (!sch.accept) {
            errs.push(`第 ${i + 1} 段：${p.leave} 班表尚未核准，無法申請`);
          }

          // 必須「整段等於班別」
          const mustStart = this.toHHMM(sch.startTime); // '11:00:00' -> '11:00'
          const mustEnd   = this.toHHMM(sch.endTime);   // '16:00:00' -> '16:00'
          const userStart = this.toHHMM(p.startTime);
          const userEnd   = this.toHHMM(p.endTime);

          if (userStart !== mustStart || userEnd !== mustEnd) {
            errs.push(`時間需整段等於班別 ${mustStart} ~ ${mustEnd}（目前是 ${userStart} ~ ${userEnd}）`);
          }
        } catch (e: any) {
          errs.push(`第 ${i + 1} 段：班表檢核失敗（${e?.message || e}）`);
        }
      }

      if (errs.length) {
        this.openError('無法送出：\n' + errs.join('\n'));
        return;
      }

      // 整理 payload
      const normalizeTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);
      const details = this.period.map((p) => {
        const start = normalizeTime(p.startTime);
        const end   = normalizeTime(p.endTime);
        return {
          leaveDate: p.leave,
          startTime: start,
          endTime: end,
          leaveHours: Math.round(this.calcHours(p.startTime, p.endTime) * 100) / 100
        };
      });

      const payload = {
        employeeId: this.leave.employeeId,
        leaveType: this.leave.leaveType,
        leaveDescription: this.leave.leaveDescription,
        leaveProve: this.leave.leaveProve || null,
        leaveDetails: details
      };

      try {
        const res = await fetch('http://localhost:8080/leave/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const text = await res.text();
        if (!res.ok) {
          let msg = text || `HTTP ${res.status}`;
          try { msg = (text ? JSON.parse(text) : null)?.message || msg; } catch {}
          this.openError(msg);
          return;
        }

        this.dialog.open(SuccessDialogComponent, { width: '300px' });
        this.router.navigate(['/scheduling']);
      } catch (err: any) {
        this.openError('送出失敗：' + (err?.message || err));
      }
    });
  }

  // ========== 工具：時間/請求/計算 ==========
  private toHHMM(t: string): string {
    if (!t) return t;
    const [hh, mm] = t.split(':');
    return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  }

  private timeToMinutes(t: string): number {
    const [h, m] = this.toHHMM(t).split(':').map(Number);
    return h * 60 + m;
  }

  private calcHours(start: string, end: string): number {
    return (this.timeToMinutes(end) - this.timeToMinutes(start)) / 60;
  }

  // 把 'YYYY-MM-DD' 或 'YYYY/MM/DD' 正規化為 'YYYY-MM-DD'
  private toISODate(s: string): string {
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : s;
  }

  // 查詢「當天班別」
  private async fetchScheduleByEmployeeAndDate(empId: string, ymd: string): Promise<ScheduleResp | null> {
    const iso = this.toISODate(ymd);
    const url = new URL('http://localhost:8080/preschedule/getScheduleByEmployeeAndDate');
    url.searchParams.set('employeeId', empId);
    url.searchParams.set('applyDate', iso);

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    if (res.status === 204) return null;

    const raw = await res.json();

    // 兼容舊欄位：若回來是 isWorking / isAccept，就轉成 working / accept
    const working = ('working' in raw) ? !!raw.working : !!raw.isWorking;
    const accept  = ('accept'  in raw) ? !!raw.accept  : !!raw.isAccept;

    return {
      employeeId: raw.employeeId,
      applyDate: raw.applyDate,
      shiftWorkId: raw.shiftWorkId,
      working,
      accept,
      startTime: raw.startTime,
      endTime: raw.endTime
    };
  }

  // ========== 檔案上傳 ==========
  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.leave.leaveProve = reader.result as string;
        this.previewUrl = reader.result as string;
        console.log(this.leave.leaveProve)
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile() {
    this.previewUrl = null;
    this.leave.leaveProve = '';
  }
}

// ===== 型別 =====
interface LeavePeriod {
  leave: string;      // 日期 YYYY-MM-DD
  startTime: string;  // 'HH:mm'
  endTime: string;    // 'HH:mm'
}

interface ScheduleResp {
  employeeId: string;
  applyDate: string;
  shiftWorkId: number;
  working: boolean;   // ← 改名
  accept: boolean;    // ← 改名
  startTime: string;  // 'HH:mm:ss'
  endTime: string;    // 'HH:mm:ss'
}
