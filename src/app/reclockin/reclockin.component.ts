import { Component, OnInit, OnDestroy, ViewEncapsulation, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { HttpClientService } from '../@Service/HttpClientService';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';

@Component({
  selector: 'app-reclockin',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './reclockin.component.html',
  styleUrls: ['./reclockin.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReclockinComponent implements OnInit, OnDestroy {

  constructor(
    private dialogRef: MatDialogRef<ReclockinComponent>,
    private http: HttpClientService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog,
    private https: HttpClient
  ) {}

  // 狀態變數
  leftLabel = '🕐 上班打卡';
  rightLabel = '---';
  leftDisabled = false;
  rightDisabled = true;

  currentTime = '';
  currentDate = '';
  clockInTime: Date | null = null;
  clockOutTime: Date | null = null;
  restStart: Date | null = null;
  restEnd: Date | null = null;
  workDuration = '';

  showMoodRating = false;
  showModal = false;
  moodRating = 0;
  hoveredStar = 0;
  modalData = { icon: '✅', title: '', content: '' };
  private timerId: any;

  mode: 'single' | 'lunch' | 'multi' = 'single';
  round = 1;

  ngOnInit(): void {
    console.log(' Dialog data:', this.data);
    if (!this.data.employeeId) {
      this.data.employeeId = localStorage.getItem('employeeId') || '';
    }
    this.tick();
    this.timerId = setInterval(() => this.tick(), 1000);
    if (this.data?.shifts) {
      this.mode = this.detectMode(this.data.shifts);
    }

    const savedRound = localStorage.getItem('CLOCK_ROUND');
    if (savedRound) {
      this.round = parseInt(savedRound, 10);
    }
    this.loadTodayClock(); 
    this.updateButtons();
  }

  ngOnDestroy(): void {
    clearInterval(this.timerId);
  }

  private tick() {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    this.currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    this.currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${week}`;
  }

  private detectMode(shifts: any[]): 'single' | 'lunch' | 'multi' {
    if (!shifts || shifts.length <= 1) return 'single';
  
    // 正規化 + 不管順序
    const list = shifts.map(s => ({
      start: String(s.start_time ?? s.startTime ?? ''),
      end:   String(s.end_time   ?? s.endTime   ?? ''),
      id:    Number(s.shift_work_id ?? s.shiftWorkId ?? 0)
    }));
  
    const a = list[0], b = list[1];
  
    // 後端規則：id 相差 1 即連班（1↔2、3↔4）
    const consecutiveById = a.id > 0 && b.id > 0 && Math.abs(a.id - b.id) === 1;
  
    // 保底：時間無縫銜接也視為連班（含跨日 23:59:59 → 00:00:00）
    const adjacentByTime =
      (!!a.end && !!b.start && (a.end === b.start)) ||
      (!!b.end && !!a.start && (b.end === a.start)) ||
      ((a.end === '23:59:59' && b.start === '00:00:00') ||
       (b.end === '23:59:59' && a.start === '00:00:00'));
  
    return (consecutiveById || adjacentByTime) ? 'lunch' : 'multi';
  }
  

  private updateButtons(): void {
    if (this.mode === 'lunch') this.updateLunchButtons();
    else if (this.mode === 'multi') this.updateMultiButtons();
    else this.updateSingleButtons();
  }

  private updateSingleButtons() {
    if (!this.clockInTime) {
      this.leftLabel = '🕐 上班打卡';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.clockOutTime) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🕕 下班打卡';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else {
      this.leftLabel = this.rightLabel = '✅ 已完成';
      this.leftDisabled = this.rightDisabled = true;
    }
  }

  private updateLunchButtons() {
    if (!this.clockInTime) {
      this.leftLabel = '🕐 上班打卡';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.restStart) {
      this.leftLabel = '☕ 午休開始';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.restEnd) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🍱 午休結束';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else if (!this.clockOutTime) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🕕 下班打卡';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else {
      this.leftLabel = this.rightLabel = '✅ 已完成';
      this.leftDisabled = this.rightDisabled = true;
    }
  }

  private updateMultiButtons() {
    if (this.round === 1) {
      if (!this.clockInTime) {
        this.leftLabel = '🕐 第一段上班';
        this.rightLabel = '---';
        this.leftDisabled = false;
        this.rightDisabled = true;
      } else if (!this.clockOutTime) {
        this.leftLabel = '✅ 已完成';
        this.rightLabel = '🕕 第一段下班';
        this.leftDisabled = true;
        this.rightDisabled = false;
      } else {
        this.round = 2;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.updateMultiButtons();
        localStorage.setItem('CLOCK_ROUND', '2');
      }
    } else if (this.round === 2) {
      if (!this.clockInTime) {
        this.leftLabel = '🕐 第二段上班';
        this.rightLabel = '---';
        this.leftDisabled = false;
        this.rightDisabled = true;
      } else if (!this.clockOutTime) {
        this.leftLabel = '✅ 已完成';
        this.rightLabel = '🕕 第二段下班';
        this.leftDisabled = true;
        this.rightDisabled = false;
      } else {
        this.leftLabel = this.rightLabel = '✅ 已完成';
        this.leftDisabled = this.rightDisabled = true;
      }
    }
  }

  leftAction() {
    if (this.mode === 'lunch') {
      if (!this.clockInTime) this.clockIn();
      else if (!this.restStart) this.startLunch();
    } else {
      this.clockIn();
    }
  }

  rightAction() {
    if (this.mode === 'lunch') {
      if (!this.restEnd && this.restStart) this.endLunch();
      else if (!this.clockOutTime && this.restEnd) this.startClockOut();
    } else {
      this.startClockOut();
    }
  }

  clockIn() {
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, clockOn: now };

    if (!req.employeeId) {
      return;
    }

    this.http.postApi('http://localhost:8080/on', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.clockInTime = this.toDate(this.data.workDate, now);
          this.showSuccess('clockIn');
          this.updateButtons();
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
      },
      error: (err) => 
      this.dialog.open(ErrorDialogComponent, { data: { message: '上班打卡錯誤' } })
    });
  }

  startLunch() {
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, restStart: now };

    this.http.postApi('http://localhost:8080/rest/start', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.restStart = this.toDate(this.data.workDate, now);
          this.showSuccess('restStart');
          this.updateButtons();
        }
      },
      error: (err) => 
      this.dialog.open(ErrorDialogComponent, { data: { message: '上班打卡錯誤' } })
    });
  }

  endLunch() {
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, restEnd: now };
    console.log('🍱 午休結束送出:', req);
    this.http.postApi('http://localhost:8080/rest/end', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.restEnd = this.toDate(this.data.workDate, now);
          this.showSuccess('restEnd');
          this.updateButtons();
        }
      },
      error: err => console.error('❌ 午休結束錯誤:', err)
    });
  }

  startClockOut() {
    this.showMoodRating = true;
  }

  formatDisplayTime(date: Date | null): string {
    if (!date) return '--';
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const mi = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${mi}:${s}`;
  }

  private nowClockTime(): string {
    const dev = localStorage.getItem('DEV_CLOCK');
    return dev || new Date().toTimeString().substring(0, 8);
  }

  private toDate(dateStr: string, timeStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm, ss] = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, ss);
  }

  private calcWorkDuration() {
    if (!this.clockInTime || !this.clockOutTime) return;
    const diff = (this.clockOutTime.getTime() - this.clockInTime.getTime()) / 1000;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    this.workDuration = `${h}小時${m}分鐘`;
  }

  private loadTodayClock(): void {
    const workDate = (this.data.workDate ?? new Date().toISOString().slice(0, 10));
    const employeeId = this.data.employeeId;
  
    // 方式一：用原生 HttpClient（建議）
    this.https.get<any>('http://localhost:8080/single/date', {
      params: { employeeId, workDate }
    }).subscribe({
      next: (res) => {
        if (res.code === 200 && Array.isArray(res.data) && res.data.length) {
          const latest = res.data[res.data.length - 1];
          if (latest.clockOn)  this.clockInTime  = new Date(`${latest.workDate}T${latest.clockOn}`);
          if (latest.clockOff) this.clockOutTime = new Date(`${latest.workDate}T${latest.clockOff}`);
          this.updateButtons();
        }
      },
      error: (err) => console.error('載入今日打卡狀態錯誤', err)
    });
  }
  
  

  completeClockOut() {
    this.showMoodRating = false;
    const selectedRating = this.hoveredStar || this.moodRating;
    const now = this.nowClockTime();
    const req = {
      employeeId: this.data.employeeId,
      clockOff: now,
      score: selectedRating
    };
  
    this.http.postApi('http://localhost:8080/clock/off2', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.clockOutTime = this.toDate(this.data.workDate, now);
          this.calcWorkDuration();
          this.showSuccess('clockOut', selectedRating);
          this.updateButtons();
  
          if (this.mode === 'multi' && this.round === 2) {
            localStorage.removeItem('CLOCK_ROUND');
            this.round = 1;
          }

          // 重置心情星星
          setTimeout(() => {
            this.moodRating = 0;
            this.hoveredStar = 0;
          }, 500);
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
      },
      error: (err) => {
        this.dialog.open(ErrorDialogComponent, { data: { message: '伺服器錯誤' } });
      }
    });
  }

showSuccess(type: 'clockIn' | 'clockOut' | 'restStart' | 'restEnd', score?: number) {
  const now = new Date();
  const timeStr = this.formatDisplayTime(now);
  if (type === 'clockOut') {
    const rating = typeof score === 'number' ? score : 0;
    const moodText = this.getMoodText(rating);
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<span style="font-size:22px; color:${i < rating ? '#FFD700' : '#ccc'};">★</span>`
    ).join('');
    this.modalData = {
      icon: '✅',
      title: '下班打卡成功！',
      content: `
        <div style="text-align:center;">
          <p style="font-size:15px; color:#555;">打卡時間：<b>${timeStr}</b></p>
          <p style="font-size:15px; color:#333; margin:3px 0;">今日心情評分</p>
          <div style="margin:3px 0;">${stars}</div>
          <p style="font-size:14px; color:#444; margin:2px 0;">${moodText}</p>
          <p style="font-size:15px; color:#444; margin-top:4px;">
            今日工作時長：<b>${this.workDuration}</b>
          </p>
        </div>
      `
    };
  }
  else if (type === 'clockIn') {
    this.modalData = {
      icon: '✅',
      title: '上班打卡成功！',
      content: `
        <div style="text-align:center;">
          <p style="margin:6px 0; font-size:15px; color:#555;">
            打卡時間：<b>${timeStr}</b>
          </p>
          <p style="margin:6px 0; font-size:16px; color:#333;">祝您工作愉快！</p>
        </div>
      `
    };
  }
  else if (type === 'restStart') {
    this.modalData = {
      icon: '☕',
      title: '午休開始！',
      content: `
        <div style="text-align:center;">
          <p style="margin:6px 0; font-size:15px; color:#555;">時間：<b>${timeStr}</b></p>
          <p style="margin:6px 0; font-size:16px; color:#333;">好好休息一下吧 😌</p>
        </div>
      `
    };
  }
  else if (type === 'restEnd') {
    this.modalData = {
      icon: '🍱',
      title: '午休結束！',
      content: `
        <div style="text-align:center;">
          <p style="margin:6px 0; font-size:15px; color:#555;">時間：<b>${timeStr}</b></p>
          <p style="margin:6px 0; font-size:16px; color:#333;">回到崗位加油！💪</p>
        </div>
      `
    };
  }
  this.showModal = true;
}

  closeModal() { this.showModal = false; }
  closeAndRefresh() { this.dialogRef.close(true); }
  setHoveredStar(s: number) { this.hoveredStar = s; }
  setMoodRating(s: number) { this.moodRating = s; }
  getMoodText(r: number) { return ['', '很糟糕 😞', '不太好 😕', '一般般 😐', '還不錯 😊', '非常好 😄'][r] || ''; }
  closeMoodRating() { this.showMoodRating = false; }
}
