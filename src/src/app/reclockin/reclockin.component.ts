import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-reclockin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reclockin.component.html',
  styleUrls: ['./reclockin.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReclockinComponent implements OnInit, OnDestroy {
  constructor(private dialogRef: MatDialogRef<ReclockinComponent>) {}

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
  }
  ngOnDestroy(): void {
    clearInterval(this.timerId);
  }

  private tick() {
    const now = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    const wk = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][now.getDay()];
    this.currentTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    this.currentDate = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${wk}`;
  }

  clockIn() {
    if (this.isClockingIn) return;
    this.isClockingIn = true;
    setTimeout(() => {
      this.clockInTime = new Date();
      this.isClockingIn = false;
      this.showSuccess('上班打卡成功！',
        `打卡時間：<b>${this.formatDateTime(this.clockInTime!)}</b><br>祝您工作愉快！`);
    }, 400);
  }

  startClockOut() {
    if (this.isClockingOut) return;
    this.isClockingOut = true;
    this.showMoodRating = true;
  }

  setHoveredStar(s: number) { this.hoveredStar = s; }
  setMoodRating(s: number) { this.moodRating = s; }
  getMoodText(r: number) {
    return ['', '很糟糕 😞', '不太好 😕', '一般般 😐', '還不錯 😊', '非常好 😄'][r] || '';
  }

  completeClockOut() {
    this.showMoodRating = false;
    setTimeout(() => {
      this.clockOutTime = new Date();
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
    }, 400);
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
