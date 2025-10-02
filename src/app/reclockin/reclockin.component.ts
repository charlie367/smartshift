import { Component, OnInit, OnDestroy, ViewEncapsulation, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';


import { MatIconModule } from '@angular/material/icon';
import { HttpClientService } from '../@Service/HttpClientService ';

@Component({
  selector: 'app-reclockin',
  standalone: true,
  imports: [CommonModule,MatIconModule],
  templateUrl: './reclockin.component.html',
  styleUrls: ['./reclockin.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReclockinComponent implements OnInit, OnDestroy {
  constructor(private dialogRef: MatDialogRef<ReclockinComponent>,private http: HttpClientService,    @Inject(MAT_DIALOG_DATA) public data: any ) {}
  canWorkToday: boolean | null = null;
  banReason = '';
  currentTime = '';
  currentDate = '';

  clockInTime: Date | null = null;
  clockOutTime: Date | null = null;
  workDuration = '';

  isClockingIn = false;
  isClockingOut = false;

  showMoodRating = false;
  moodRating = 0;
  hoveredStar = 0;

  showModal = false;
  modalData = { icon: '✅', title: '', content: '' };

  private timerId: any;

  ngOnInit(): void {
    this.tick();
    this.timerId = setInterval(() => this.tick(), 1000);
  
    // << 新增：由父元件帶進來的今天紀錄，直接顯示
    const wd = this.data?.workDate || this.todayLocal();
    if (this.data?.clockOn)  this.clockInTime  = this.toDate(wd, this.data.clockOn);
    if (this.data?.clockOff) this.clockOutTime = this.toDate(wd, this.data.clockOff);
    if (this.clockInTime && this.clockOutTime) this.calcWorkDuration();

  }
  


  ngOnDestroy(): void {
    clearInterval(this.timerId);
  }

  closeAndRefresh() {
    this.dialogRef.close(true); // 傳回父元件刷新訊號
  }


  private todayLocal(): string {
    const n = new Date(), p = (x:number)=>x.toString().padStart(2,'0');
    return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
  }
  private toDate(dateStr: string, timeStr: string): Date {
    const [y,m,d] = dateStr.split('-').map(Number);
    const [hh,mm,ss] = timeStr.split(':').map(Number);
    return new Date(y, m-1, d, hh, mm, ss);
  }
  
  private tick() {
    const now = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    const wk = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][now.getDay()];
    this.currentTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    this.currentDate = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${wk}`;
  }

  clockIn() {

    if (this.canWorkToday === false) {
      this.showSuccess('今日未排班', this.banReason || '今天不是排班日，無法打卡');
      return;
    }
  
    if (this.isClockingIn) return;
    this.isClockingIn = true;
  
    const now = new Date();
    const employeeId = localStorage.getItem("employeeId") || "";
  
    const req = {
      employeeId,
      workDate: this.todayLocal(),
      clockOn: now.toTimeString().substring(0, 8)
    };
  
    this.http.postApi('http://localhost:8080/clock/on', req).subscribe({
      next: (res: any) => {
        this.clockInTime = now;
        this.isClockingIn = false;
        this.showSuccess(
          res?.message || '上班打卡成功！',
          `打卡時間：<b>${this.formatDateTime(this.clockInTime!)}</b><br>祝您工作愉快！`
        );
      },
      error: (err) => {
        this.isClockingIn = false;
        const msg = err?.error?.message || err?.message || '發生未知錯誤';
        this.showSuccess('打卡失敗', `錯誤訊息：${msg}`);
      }
    });
  }
  
  startClockOut() {

    if (this.canWorkToday === false) {
      this.showSuccess('今日未排班', this.banReason || '今天不是排班日，無法打卡');
      return;
    }
    // （雙保險）尚未上班打卡也擋住，避免 F12 直接叫用
    if (!this.clockInTime) {
      this.showSuccess('尚未上班打卡', '請先完成上班打卡');
      return;
    }
  
    if (this.isClockingOut) return;
    this.isClockingOut = true;
    this.showMoodRating = true; // 照你原流程先開心情評分，再送出 clockOff
  }
  

  setHoveredStar(s: number) { this.hoveredStar = s; }
  setMoodRating(s: number) { this.moodRating = s; }
  getMoodText(r: number) {
    return ['', '很糟糕 😞', '不太好 😕', '一般般 😐', '還不錯 😊', '非常好 😄'][r] || '';
  }

  completeClockOut() {
    this.showMoodRating = false;

    const now = new Date();

const employeeId = localStorage.getItem("employeeId") || "";

const req = {
  employeeId: employeeId,
  workDate: this.todayLocal(),                 // << 同上
  clockOff: now.toTimeString().substring(0, 8),
  score: this.moodRating
};

    this.http.postApi('http://localhost:8080/clock/off', req).subscribe({
      next: (res: any) => {
        this.clockOutTime = now;
        this.calcWorkDuration();
        this.isClockingOut = false;

        const stars = '★'.repeat(this.moodRating) + '☆'.repeat(5 - this.moodRating);
        this.showSuccess(
          '下班打卡成功！',
          `打卡時間：<b>${this.formatDateTime(this.clockOutTime!)}</b><br>
           今日心情評分<br><span style="font-size:18px;letter-spacing:2px">${stars}</span><br>
           ${this.getMoodText(this.moodRating)}<br>
           今日工作時長 <b>${this.workDuration || '—'}</b>`
        );
      },
      error: (err) => {
        this.isClockingOut = false;
        this.showSuccess('打卡失敗', `錯誤訊息：${err.message}`);
      }
    });
  }

  private calcWorkDuration() {
    if (this.clockInTime && this.clockOutTime) {
      const diff = this.clockOutTime.getTime() - this.clockInTime.getTime();
      const h = Math.max(0, Math.floor(diff / 3_600_000));
      const m = Math.max(0, Math.floor((diff % 3_600_000) / 60_000));
      this.workDuration = `${h}小時${m}分鐘`;
    } else {
      this.workDuration = '';
    }
  }

  formatDisplayTime(d: Date | null): string { return d ? this.formatDateTime(d) : ''; }
  private formatDateTime(d: Date) {
    const p = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  showSuccess(title: string, content: string) {
    this.modalData = { icon: '✅', title, content };
    this.showModal = true;
  }
  closeMoodRating() { this.showMoodRating = false; this.isClockingOut = false; }
  closeModal() { this.showModal = false; }
  closeDialog() { this.dialogRef.close(); }
}
