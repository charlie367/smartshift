import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { Router, RouterLink } from '@angular/router';

import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular';

import { FeedbackDialogComponent } from '../feedback-dialog/feedback-dialog.component';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import { ClockComponent } from '../clock/clock.component';
import { WaterdropComponent } from '../waterdrop/waterdrop.component';
import { ReclockinComponent } from '../reclockin/reclockin.component';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-scheduling',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterLink,

    // Angular Material
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,

    // 3rd party
    DayPilotModule,

    // 自家 standalone 元件
    ClockComponent,
    WaterdropComponent,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'zh-TW' }],
  templateUrl: './scheduling.component.html',
  styleUrls: ['./scheduling.component.scss'],
})
export class SchedulingComponent implements OnInit {
  shifts = [
    { name: 'Amir Al Azimi', date: '2025/03/04', time: '15:00 - 20:00', role: '外送員', type: '晚班' },
    { name: 'Moira Andrews', date: '2025/03/06', time: '13:00 - 20:00', role: '外送員', type: '早班' },
    { name: 'Emily Simchenko', date: '2025/03/07', time: '10:00 - 18:00', role: '內場', type: '日班' },
    { name: 'Amir Al Azimi', date: '2025/03/04', time: '15:00 - 20:00', role: '外送員', type: '晚班' },
    { name: 'Moira Andrews', date: '2025/03/06', time: '13:00 - 20:00', role: '外送員', type: '早班' },
    { name: 'Emily Simchenko', date: '2025/03/07', time: '10:00 - 18:00', role: '內場', type: '日班' },
  ];

  currentMonthIndex = 0;
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  get currentMonthName() {
    return this.months[this.currentMonthIndex];
  }

  avgCheckIn = '9:16';
  avgCheckOut = '5:10';
  avgWorkHr = '8:10';

  workLogs = [
    { date: 'Wed, 01 Jan, 2025', checkIn: '9:11', checkOut: '5:01', hours: '8:10 hr' },
    { date: 'Thu, 02 Jan, 2025', checkIn: '9:12', checkOut: '5:00', hours: '8:08 hr' },
    { date: 'Fri, 03 Jan, 2025', checkIn: '9:10', checkOut: '5:02', hours: '8:12 hr' },
    { date: 'Sat, 04 Jan, 2025', checkIn: '9:13', checkOut: '5:01', hours: '8:09 hr' },
    { date: 'Wed, 01 Jan, 2025', checkIn: '9:11', checkOut: '5:01', hours: '8:10 hr' },
    { date: 'Thu, 02 Jan, 2025', checkIn: '9:12', checkOut: '5:00', hours: '8:08 hr' },
    { date: 'Fri, 03 Jan, 2025', checkIn: '9:10', checkOut: '5:02', hours: '8:12 hr' },
    { date: 'Sat, 04 Jan, 2025', checkIn: '9:13', checkOut: '5:01', hours: '8:09 hr' },
  ];

  prevMonth() {
    if (this.currentMonthIndex > 0) this.currentMonthIndex--;
  }
  nextMonth() {
    if (this.currentMonthIndex < this.months.length - 1) this.currentMonthIndex++;
  }

  events: DayPilot.EventData[] = [
    { id: '1', start: '2025-09-19T09:00:00', end: '2025-09-19T11:00:00', text: '早班' },
    { id: '2', start: '2025-09-19T13:00:00', end: '2025-09-19T17:00:00', text: '午班' },
  ];

  config: DayPilot.SchedulerConfig = {
    startDate: '2025-09-19',
    days: 1,
    scale: 'Hour',
    cellWidth: 70,
    resources: [
      { name: '員工A', id: 'A' },
      { name: '員工B', id: 'B' },
    ],
  };

  // 原本有 'leave' 但未用到（改成僅兩種）
  viewMode: 'dashboard' | 'schedule' = 'dashboard';

  selectedDate: Date | null = null;
  startOfWeek: Date = this.getStartOfWeek(new Date());
  messages: Message[] = [];

  // 範例時段
  timeSlots = ['上午 3:30', '上午 4:30', '上午 5:30'];

  constructor(
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // 預設助理先打招呼
    this.messages.push({
      sender: 'assistant',
      text: '哈囉！我是您的 AI 助理  今天有什麼可以幫忙的嗎？',
    });
  }

  showSchedule() {
    this.viewMode = 'schedule';
  }
  goHome() {
    this.viewMode = 'dashboard';
  }

  punchIn(): void {
    this.dialog.open(ReclockinComponent, {
      panelClass: 'punch-dialog-panel',
      width: '600px',
      height: '650px',
      maxWidth: 'none',
      autoFocus: false,
      restoreFocus: false,
    });
  }

  // 取得當週週日
  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  // 當週 7 天
  get weekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }

  prevWeek() {
    this.startOfWeek.setDate(this.startOfWeek.getDate() - 7);
    this.startOfWeek = new Date(this.startOfWeek);
  }
  nextWeek() {
    this.startOfWeek.setDate(this.startOfWeek.getDate() + 7);
    this.startOfWeek = new Date(this.startOfWeek);
  }

  onDateSelected(date: Date) {
    this.selectedDate = date;
    this.startOfWeek = this.getStartOfWeek(date);
    this.messages = [{ sender: 'assistant', text: '助理正在生成回覆...' }];

    this.http
      .post('http://localhost:8080/api/newtable/ask', {
        selectedDate: date,
        userMessage: `我剛剛選的日期是 ${date.toLocaleDateString('zh-TW')}`,
      })
      .subscribe({
        next: (res: any) => {
          this.messages[0] = {
            sender: 'assistant',
            text: res.assistantReply || 'AI 沒有回覆',
          };
        },
        error: (err) => {
          this.messages[0] = {
            sender: 'assistant',
            text: `API 錯誤：${err.message}`,
          };
        },
      });
  }

  openFeedbackDialog() {
    const dialogRef = this.dialog.open(FeedbackDialogComponent, {
      autoFocus: false,
      restoreFocus: false,
      width: undefined,
      height: undefined,
      maxWidth: 'none',
      maxHeight: 'none',
      panelClass: 'punch-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log('使用者填寫的資料:', result);
        // 這裡可以送 API 或顯示訊息
      }
    });
  }

  openAnnouncementDialog() {
    this.dialog.open(AnnouncementDialogComponent, {
      width: '800px',
      height: '600px',
    });
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}
