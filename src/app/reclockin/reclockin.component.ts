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
    console.log('🟢 Dialog data:', this.data);
    if (!this.data.employeeId) {
      this.data.employeeId = localStorage.getItem('employeeId') || '';
      console.log('⚙️ 自動帶入 employeeId：', this.data.employeeId);
    }

    this.tick();
    this.timerId = setInterval(() => this.tick(), 1000);

    if (this.data?.shifts) {
      this.mode = this.detectMode(this.data.shifts);
      console.log(`📘 今日班別模式：${this.mode}`);
    }

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
    if (!shifts || shifts.length === 0) return 'single';
    if (shifts.length === 1) return 'single';
    if (shifts.length === 2) {
      const s1 = shifts[0];
      const s2 = shifts[1];
      if (s1.end_time === s2.start_time) {
        return 'lunch';
      } else {
        return 'multi';
      }
    }
    return 'multi';
  }


  private updateButtons(): void {
    console.log('🔄 更新按鈕狀態...');
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
    console.log(`👈 左鍵觸發 | 模式=${this.mode}`);
    if (this.mode === 'lunch') {
      if (!this.clockInTime) this.clockIn();
      else if (!this.restStart) this.startLunch();
    } else {
      this.clockIn();
    }
  }

  rightAction() {
    console.log(`👉 右鍵觸發 | 模式=${this.mode}`);
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
    console.log('⬆️ 上班打卡送出:', req);

    if (!req.employeeId) {
      console.error('❌ 缺少 employeeId，無法打卡');
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
      error: err => console.error('❌ 上班打卡錯誤:', err)
    });
  }


  startLunch() {
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, restStart: now };
    console.log('☕ 午休開始送出:', req);

    this.http.postApi('http://localhost:8080/rest/start', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.restStart = this.toDate(this.data.workDate, now);
          this.showSuccess('restStart');
          this.updateButtons();
        }
      },
      error: err => console.error('❌ 午休開始錯誤:', err)
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

completeClockOut() {
  this.showMoodRating = false;


  const selectedRating = this.hoveredStar || this.moodRating;

  const now = this.nowClockTime();
  const req = {
    employeeId: this.data.employeeId,
    workDate: this.data.workDate,
    clockOff: now,
    score: selectedRating
  };
  console.log("⬇️ 下班打卡送出:", req);

  this.http.postApi('http://localhost:8080/clock/off2', req).subscribe({
    next: (res: any) => {
      if (res.code === 200) {
        this.clockOutTime = this.toDate(this.data.workDate, now);
        this.calcWorkDuration();

  
        this.showSuccess('clockOut', selectedRating);

        this.updateButtons();

        setTimeout(() => {
          this.moodRating = 0;
          this.hoveredStar = 0;
        }, 500);
      } else {
        this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
      }
    },
    error: () => {
      this.dialog.open(ErrorDialogComponent, { data: { message: '伺服器錯誤' } });
    }
  });
}



showSuccess(type: 'clockIn' | 'clockOut' | 'restStart' | 'restEnd', score?: number) {
  const now = new Date();
  const timeStr = this.formatDisplayTime(now);

  if (type === 'clockOut') {

    const rating = typeof score === 'number' ? score : 0;
    console.log("🎯 顯示星數:", rating);

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
