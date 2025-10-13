import { Component, OnInit, OnDestroy, ViewEncapsulation, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';


import { MatIconModule } from '@angular/material/icon';
import { HttpClientService } from '../@Service/HttpClientService ';
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
  //這個子元件是一個「對話框」，會自動接收父元件用 data 傳進來的資料，並透過 this.data 來使用。
  constructor(private dialogRef: MatDialogRef<ReclockinComponent>, private http: HttpClientService, @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog,) { }

  leftLabel = "🕐 上班打卡";
  rightLabel = "---";
  leftDisabled = false;
  rightDisabled = true;
  needsLunch = false;
  restStart: Date | null = null;
  restEnd: Date | null = null;
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
    //每隔 1 秒，自動重新執行一次 tick() 方法，更新時間和日期顯示
    //() => this.tick() 可以保證 this 仍然指向元件本身，不會跑掉去指向 setInterval 的內部環境
    this.timerId = setInterval(() => this.tick(), 1000);
    const wd = this.data.workDate;
    if (this.data?.clockOn) {
      this.clockInTime = this.toDate(wd, this.data.clockOn);
      this.leftLabel = "✅ 已完成";
      this.leftDisabled = true;
    }
    if (this.data?.clockOff) {
      this.clockOutTime = this.toDate(wd, this.data.clockOff);
      this.rightLabel = "✅ 已完成";
      this.rightDisabled = true;
    }
    if (this.clockInTime && this.clockOutTime) this.calcWorkDuration();

    if (this.data?.shifts) {
      this.needsLunch = this.checkLunchNeed(this.data.shifts);
      console.log("是否需要午休：", this.needsLunch);
    }

    this.data.shifts = [
      { start_time: "06:00:00", end_time: "11:00:00" },
      { start_time: "11:00:00", end_time: "16:00:00" }
    ];

    this.needsLunch = this.checkLunchNeed(this.data.shifts);
    console.log("是否需要午休：", this.needsLunch);
  }

  private toDate(dateStr: string, timeStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm, ss] = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, ss);
  }

  handleLeftButton() {
    if (this.leftLabel === "🕐 上班打卡") {
      this.clockIn();
      this.leftLabel = "🍴 午休開始";
      this.rightLabel = "---";
      this.leftDisabled = false;
      this.rightDisabled = true;
    }
    else if (this.leftLabel === "🍴 午休開始") {
      this.startLunch();
      this.leftLabel = "✅ 已完成";
      this.leftDisabled = true;
      this.rightLabel = "☕ 午休結束";
      this.rightDisabled = false;
    }
  }

  handleRightButton() {
    if (this.rightLabel === "☕ 午休結束") {
      this.endLunch();
      this.rightLabel = "🕕 下班打卡";
      this.rightDisabled = false;
    }
    else if (this.rightLabel === "🕕 下班打卡") {
      this.startClockOut();
      this.rightLabel = "✅ 已完成";
      this.rightDisabled = true;
    }
  }

  private calcWorkDuration() {
    if (this.clockInTime && this.clockOutTime) {
      //getTime算毫秒
      const diffMs = this.clockOutTime.getTime() - this.clockInTime.getTime();
      const diffs = Math.floor(diffMs / 1000); // 總秒數
      const h = Math.floor(diffs / 3600);         // 幾小時
      const m = Math.floor((diffs % 3600) / 60);  // 剩下的分鐘
      this.workDuration = h + "小時" + m + "分鐘";
    } else {
      this.workDuration = '';
    }
  }

  //讓頁面關閉時自動的時鐘也可以停止
  //clearInterval，功能是：停止由 setInterval 建立的重複計時器
  ngOnDestroy(): void {
    clearInterval(this.timerId);
  }

  private tick() {
    const now = new Date();
    const p = (n: number) => n.toString().padStart(2, '0');
    //arr[index] 表示「取陣列 arr 裡第 index 個值」。
    const wk = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()];
    this.currentTime = p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds());
    this.currentDate = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日 " + wk;
  }

  closeAndRefresh() {
    this.dialogRef.close(true); // 傳回父元件刷新訊號
  }

  clockIn() {
    if (this.isClockingIn) return;
    this.isClockingIn = true;
    const now = new Date();
    const employeeId = localStorage.getItem("employeeId") || "";
    const req = {
      employeeId: employeeId,
      workDate: this.data.workDate,
      clockOn: now.toTimeString().substring(0, 8),
    };
    this.http.postApi('http://localhost:8080/clock/on', req).subscribe({
      next: (res: any) => {
        this.clockInTime = now;
        this.isClockingIn = false;
        this.showSuccess('clockIn');
      },
      error: (err) => {
        this.isClockingIn = false;
        this.dialog.open(ErrorDialogComponent,
          { data: { message: err?.error?.message || '伺服器錯誤' }, width: '280px' });
      }
    });
  }

  formatDisplayTime(d: Date | null): string { return d ? this.formatDateTime(d) : ''; }

  private formatDateTime(d: Date) {
    const p = (n: number) => n.toString().padStart(2, '0');
    return d.getFullYear() + "/" +
      p(d.getMonth() + 1) + "/" +
      p(d.getDate()) + " " +
      p(d.getHours()) + ":" +
      p(d.getMinutes()) + ":" +
      p(d.getSeconds());
    ;
  }

  showSuccess(type: 'clockIn' | 'clockOut') {
    if (type === 'clockIn') {
      this.modalData = {
        icon: '✅',
        title: '上班打卡成功！',
        //<b>粗體
        content: `打卡時間：<b>${this.formatDateTime(this.clockInTime!)}</b><br>祝您工作愉快！`
      };
    } else {
      const stars = '★'.repeat(this.moodRating) + '☆'.repeat(5 - this.moodRating);
      this.modalData = {
        icon: '✅',
        title: '下班打卡成功！',
        content: "打卡時間：<b>" + this.formatDateTime(this.clockOutTime!) + "</b><br>" +
          //letter-spacing: 2px 可以讓每顆星之間更「疏開」一點
          "今日心情評分<br><span style='font-size:18px;letter-spacing:2px'>" + stars + "</span><br>" +
          this.getMoodText(this.moodRating) + "<br>" +
          "今日工作時長 <b>" + (this.workDuration || '—') + "</b>"
      };
    }
    this.showModal = true;
  }

  startClockOut() {
    if (this.isClockingOut) return;
    this.isClockingOut = true;
    this.showMoodRating = true;
  }
  //hoveredStar 是暫時性的預覽（滑鼠移過去時）。
  //moodRating 是真正選定的評分（點擊後）。
  setHoveredStar(s: number) { this.hoveredStar = s; }
  setMoodRating(s: number) { this.moodRating = s; }
  getMoodText(r: number) {
    return ['', '很糟糕 😞', '不太好 😕', '一般般 😐', '還不錯 😊', '非常好 😄'][r] || '';
  }

  closeMoodRating() { this.showMoodRating = false; this.isClockingOut = false; }

  closeModal() { this.showModal = false; }

  closeDialog() { this.dialogRef.close(); }

  completeClockOut() {
    this.showMoodRating = false;
    const now = new Date();
    const employeeId = localStorage.getItem("employeeId") || "";
    const req = {
      employeeId: employeeId,
      workDate: this.data.workDate,
      restStart: this.restStart ? this.restStart.toTimeString().substring(0, 8) : null,
      restEnd: this.restEnd ? this.restEnd.toTimeString().substring(0, 8) : null,
      clockOff: now.toTimeString().substring(0, 8),
      score: this.moodRating
    };

    console.log("送出的打卡資料：", req);

    this.http.postApi('http://localhost:8080/clock/off', req).subscribe({
      next: (res: any) => {
        this.clockOutTime = now;
        this.calcWorkDuration();
        this.isClockingOut = false;
        this.showSuccess('clockOut');
      },
      error: (err) => {
        this.isClockingOut = false;
        this.dialog.open(ErrorDialogComponent,
          { data: { message: err?.error?.message || '伺服器錯誤' }, width: '280px' });
      }
    });
  }

  startLunch() {
    this.restStart = new Date();
  }

  endLunch() {
    this.restEnd = new Date();
  }

  checkLunchNeed(shifts: any[]): boolean {
    if (!shifts || shifts.length < 2) return false;
    //sort用來對陣列元素進行排序，可以依照字串、數字，甚至是你自己定義的規則來排序。
    //大於就往後，小於就往前。
    shifts.sort((a, b) => a.start_time > b.start_time ? 1 : -1);
    for (let i = 0; i < shifts.length - 1; i++) {
      if (shifts[i].end_time === shifts[i + 1].start_time) {
        return true;
      }
    }
    return false;
  }
}
