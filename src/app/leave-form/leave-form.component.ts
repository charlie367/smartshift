import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import { CommonModule } from '@angular/common';

interface LeavePeriod {
  leave: string;
  startTime: string;
  endTime: string;
  dayShift?: string; // 顯示用（例如：早班 / 晚班）
  availableShifts?: { name: string; start: string; end: string }[];
}

interface WholeDay {
  leaveDate: string;
  shift1?: string;
  shift2?: string;
  shiftType?: string;
  availableShifts?: string[];
}

@Component({
  selector: 'app-leave-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-form.component.html',
  styleUrl: './leave-form.component.scss',
})
export class LeaveFormComponent {
  constructor(private router: Router, private dialog: MatDialog) {}

readonly SHIFT_TIMETABLE = [
 
  { name: '早班', time: '08:00–12:00', dotClass: 'morning' },
  { name: '中班', time: '12:00–16:00', dotClass: 'afternoon' },
  { name: '晚班', time: '16:00–20:00', dotClass: 'evening' },
  { name: '夜班', time: '20:00–00:00', dotClass: 'night' },
];


  period: LeavePeriod[] = [];
  wholeDays: WholeDay[] = [];
  previewUrl: string | null = null;
  isSubmitting = false; 

  hourOptions: string[] = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  leave = {
    employeeId: localStorage.getItem('employeeId') || '',
    leaveType: '',
    leaveDescription: '',
    totalHours: '',
    leaveProve: '',
    isWholeDay: '',
  };

  private API_BASE = 'http://localhost:8080';

  openErrorDialog(message: string) {
    const ref = this.dialog.open(ErrorDialogComponent, {
      width: '320px',
      panelClass: 'error-dialog-panel',
      disableClose: false,
      data: { message },
    });
    ref.afterOpened().subscribe(() => {
      const timer = setTimeout(() => ref.close(), 8000);
      ref.afterClosed().subscribe(() => clearTimeout(timer));
    });
  }

  openConfirmDialog() {
    return this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      disableClose: true,
    });
  }

  openSuccessDialog() {
    return this.dialog.open(SuccessDialogComponent, {
      width: '300px',
      disableClose: true,
    });
  }

  private toHHmmss(t: string): string {
    if (!t) return '';
    return t.length === 5 ? `${t}:00` : t;
  }

  private toMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private calcHours(start: string, end: string): number {
    const s = this.toMinutes(start);
    let e = this.toMinutes(end);
    if (e < s) e += 24 * 60; // 跨夜
    return +(((e - s) / 60)).toFixed(2);
  }

  onDayTypeChange() {
    if (this.leave.isWholeDay === '整天') this.period = [];
    else this.wholeDays = [];
  }

  addWholeDay() {
    this.wholeDays.push({ leaveDate: '', shiftType: '', availableShifts: [] });
  }

  deleteWholeDay(index: number) {
    this.wholeDays.splice(index, 1);
  }

  addPeriod() {
    this.period.push({ leave: '', startTime: '', endTime: '' });
  }

  deletePeriod(index: number) {
    this.period.splice(index, 1);
    this.updateTotalHours();
  }

  async onDateSelected(day: WholeDay) {
    if (!day.leaveDate) return;
    try {
      const res = await fetch(`${this.API_BASE}/PreSchedule/getThisDaySchedule?thisDay=${day.leaveDate}`);
      const data = await res.json();
      const myShifts = data.filter((d: any) => d.employeeId === this.leave.employeeId);

      if (myShifts.length === 0) {
        day.shift1 = '查無班別';
        day.shift2 = '';
        return;
      }

      const shiftNameMap: Record<number, string> = { 1: '早班', 2: '中班', 3: '晚班', 4: '夜班', 0: '休假' };
      day.shift1 = shiftNameMap[myShifts[0].shiftWorkId] || '未知班別';
      day.shift2 = myShifts[1] ? (shiftNameMap[myShifts[1].shiftWorkId] || '未知班別') : '';
    } catch {
      this.openErrorDialog('班別查詢失敗，請稍後再試。');
    }
  }

  updateTotalHours() {
    if (this.leave.isWholeDay !== '非整天') return;
    let totalMinutes = 0;
    for (const p of this.period) {
      if (p.startTime && p.endTime) {
        let s = this.toMinutes(p.startTime);
        let e = this.toMinutes(p.endTime);
        if (e < s) e += 24 * 60;
        totalMinutes += (e - s);
      }
    }
    this.leave.totalHours = Math.round(totalMinutes / 60).toString();
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.leave.leaveProve = reader.result as string;
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeFile() {
    this.previewUrl = null;
    this.leave.leaveProve = '';
  }

  sendJSON1() {
    this.router.navigate(['/scheduling']);
  }

  private async postPartialDay(payload: any): Promise<any> {
    const res = await fetch(`${this.API_BASE}/leave/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      try { const j = JSON.parse(text); throw new Error(j?.message || text || `HTTP ${res.status}`); }
      catch { throw new Error(text || `HTTP ${res.status}`); }
    }
    return res.json().catch(() => ({}));
  }

  private async postWholeDay(payload: any): Promise<any> {
    const res = await fetch(`${this.API_BASE}/leave/leaveApplyByDate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      try { const j = JSON.parse(text); throw new Error(j?.message || text || `HTTP ${res.status}`); }
      catch { throw new Error(text || `HTTP ${res.status}`); }
    }
    return res.json().catch(() => ({}));
  }

  async sendJSON() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
  
    const confirmRef = this.openConfirmDialog();
    const { firstValueFrom } = await import('rxjs');
    const ok = await firstValueFrom(confirmRef.afterClosed());
    if (!ok) {
      this.isSubmitting = false;
      return;
    }
  
    const errs: string[] = [];
    if (!this.leave.employeeId) errs.push('找不到員工編號');
    if (!this.leave.leaveType) errs.push('請選擇假別');
    if (this.leave.leaveType === '其他' && !this.leave.leaveDescription?.trim())
      errs.push('假別為「其他」時，請填寫請假事由');
    if (!this.leave.isWholeDay) errs.push('請選擇是否整天');
    if (this.leave.isWholeDay === '非整天' && !this.period.length)
      errs.push('請至少新增一個請假時間段');
    if (this.leave.isWholeDay === '整天' && !this.wholeDays.length)
      errs.push('請至少新增一個請假日期');
  
    if (errs.length) {
      this.openErrorDialog('無法送出：\n' + errs.join('\n'));
      this.isSubmitting = false;
      return;
    }
  
    try {
 
      if (this.leave.isWholeDay === '非整天') {
        const ok1 = await this.validatePartialDayAgainstSchedule();
        if (!ok1) { 
       
          this.isSubmitting = false; 
          return; 
        }
  
        const payload = {
          employeeId: this.leave.employeeId,
          leaveType: this.leave.leaveType,
          leaveDescription: this.leave.leaveDescription?.trim() || '',
          leaveProve: this.leave.leaveProve || null,
          leaveDetails: this.period.map(p => ({
            leaveDate: p.leave,
            startTime: this.toHHmmss(p.startTime),
            endTime: this.toHHmmss(p.endTime),
            leaveHours: this.calcHours(p.startTime, p.endTime),
          })),
        };
  
        const res = await this.postPartialDay(payload);
        if (res?.code === 200) {
          const dialogRef = this.openSuccessDialog();
          setTimeout(() => {
            dialogRef.close();
            this.router.navigate(['/scheduling']);
          }, 1500);
        } else {
          throw new Error(res?.message || '送出失敗');
        }
      }
  

      else {
        const ok2 = await this.validateWholeDayDates();
        if (!ok2) { 
          this.isSubmitting = false; 
          return; 
        }
  
        const dates = Array.from(
          new Set(this.wholeDays.map(d => (d.leaveDate || '').slice(0, 10)).filter(Boolean))
        );
        if (!dates.length) throw new Error('請至少新增一個有效的請假日期');
  
        for (const d of dates) {
          const payload = {
            employeeId: this.leave.employeeId,
            leaveType: this.leave.leaveType,
            leaveDescription: this.leave.leaveDescription?.trim() || '整天請假',
            leaveProve: this.leave.leaveProve || null,
            leaveDate: [d],
          };
  
          const res = await this.postWholeDay(payload);
          if (res?.code && +res.code !== 200)
            throw new Error(res?.message || `整天請假送出失敗（${d}）`);
        }
  
        const dialogRef = this.openSuccessDialog();
        setTimeout(() => {
          dialogRef.close();
          this.router.navigate(['/scheduling']);
        }, 1500);
      }
  
    } catch (err: any) {
  
      let friendly = '伺服器錯誤';
      try {
        const msg = (err?.message ?? '').toString();
        if (msg.startsWith('{') && msg.includes('"message"')) {
          const parsed = JSON.parse(msg);
          if (parsed?.message) friendly = parsed.message;
        } else if (msg.includes('"message":')) {
          const match = msg.match(/"message"\s*:\s*"([^"]+)"/);
          if (match && match[1]) friendly = match[1];
        } else {
          friendly = msg;
        }
  
        if (friendly.includes('申請日期重複')) friendly = '你選的請假日期與既有申請重複';
        else if (friendly.includes('申請時段重複')) friendly = '你填寫的請假時段與既有申請重複';
        else if (friendly.includes('沒有上班')) friendly = '當天沒有上班，無法請假';
        else if (friendly.includes('不在上班時間內')) friendly = '請假時段不在上班時間內，請確認班表';
        else if (friendly.includes('不可晚於')) friendly = '請假時間區間設定錯誤';
      } catch {
        friendly = '伺服器錯誤，請稍後再試';
      }
  
      this.openErrorDialog('送出失敗：' + friendly);
    } finally {
      this.isSubmitting = false;
    }
  }
  

private async validatePartialDayAgainstSchedule(): Promise<boolean> {
  for (const [i, p] of this.period.entries()) {
    if (!p.leave || !p.startTime || !p.endTime) {
      this.openErrorDialog(`第 ${i + 1} 個時間段資料不完整`);
      return false;
    }

    const sMin = this.toMinutes(p.startTime);
    const eMin = this.toMinutes(p.endTime);

 
    if (sMin >= eMin) {
      this.openErrorDialog(`第 ${i + 1} 個時間段的開始時間不可晚於或等於結束時間`);
      return false;
    }

    try {
      const res = await fetch(`${this.API_BASE}/PreSchedule/getThisDaySchedule?thisDay=${p.leave}`);
      const data = await res.json();
      const myShifts = data.filter((s: any) => s.employeeId === this.leave.employeeId);

      if (myShifts.length === 0 || myShifts.every((s: any) => s.shiftWorkId === 0)) {
        this.openErrorDialog(`${p.leave} 該日為休假或未排班，無法請假。`);
        return false;
      }

  
      const validShifts = myShifts.filter((s: any) => {
        const st = (s.startTime as string).slice(0, 5);
        const et = (s.endTime as string).slice(0, 5);
      
        return !(st === '08:00' && et === '00:00');
      });

      const isInsideAnyShift = validShifts.some((s: any) => {
        const ss = this.toMinutes((s.startTime as string).slice(0, 5));
        let se = this.toMinutes((s.endTime as string).slice(0, 5));
        if (se < ss) se += 24 * 60; 

     
        return sMin >= ss && eMin <= se;
      });

      if (!isInsideAnyShift) {
        this.openErrorDialog(`${p.leave} 的請假時段不在上班時間內，請確認班表。`);
        return false;
      }

    } catch {
      this.openErrorDialog(`查詢班別失敗（${p.leave}）`);
      return false;
    }
  }

  return true;
}

goToViewer() {
  this.router.navigate(['/leave-requests'], {
    queryParams: { search: this.leave.employeeId || '' }
  });
}
  private async validateWholeDayDates(): Promise<boolean> {
    for (const d of this.wholeDays) {
      if (!d.leaveDate) {
        this.openErrorDialog('請選擇請假日期');
        return false;
      }
      try {
        const res = await fetch(`${this.API_BASE}/PreSchedule/getThisDaySchedule?thisDay=${d.leaveDate}`);
        const data = await res.json();
        const myShifts = data.filter((s: any) => s.employeeId === this.leave.employeeId);
        if (myShifts.length === 0 || myShifts.every((s: any) => s.shiftWorkId === 0)) {
          this.openErrorDialog(`${d.leaveDate} 該日為休假或未排班，無法請整天假。`);
          return false;
        }
      } catch {
        this.openErrorDialog(`查詢班別失敗（${d.leaveDate}）`);
        return false;
      }
    }
    return true;
  }
  

async onPartialDateSelected(item: LeavePeriod) {
  if (!item.leave) { item.dayShift = ''; item.availableShifts = []; return; }

  try {
    const res = await fetch(
      `${this.API_BASE}/PreSchedule/getThisDaySchedule?thisDay=${encodeURIComponent(item.leave)}`
    );
    const data = await res.json();
    const my = (data || []).filter((d: any) => d.employeeId === this.leave.employeeId);

    if (!my.length) {
      item.dayShift = '休假/未排班';
      item.availableShifts = [];
      return;
    }

    const nameMap: Record<number, string> = {
      1: '早班', 2: '中班', 3: '晚班', 4: '夜班', 0: '休假'
    };

    item.availableShifts = my.map((s: any) => ({
      name: nameMap[s.shiftWorkId] ?? '未知',
      start: String(s.startTime).slice(0, 5),
      end: String(s.endTime).slice(0, 5),
    }));

    // 顯示「早班 / 中班」這種文字
    item.dayShift = (item.availableShifts ?? []).map(s => s.name).join(' / ');

  } catch {
    item.dayShift = '查詢失敗';
    item.availableShifts = [];
    this.openErrorDialog('班別查詢失敗，請稍後再試。');
  }
}

}
