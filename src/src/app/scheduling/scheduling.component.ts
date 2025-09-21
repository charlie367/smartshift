import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CalendarModule } from 'primeng/calendar';
import { MatIconModule } from "@angular/material/icon";
import { MatDialog } from '@angular/material/dialog';
import { FeedbackDialogComponent } from '../feedback-dialog/feedback-dialog.component';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import { ClockComponent } from '../clock/clock.component';
import { WaterdropComponent } from '../waterdrop/waterdrop.component';
import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular';
import { ReclockinComponent } from '../reclockin/reclockin.component';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-scheduling',
  standalone: true, 
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, RouterOutlet, CommonModule, FormsModule, MatDatepickerModule, MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatButtonModule, MatCalendar, CalendarModule, HttpClientModule, MatTabsModule, MatIconModule,ClockComponent,WaterdropComponent,DayPilotModule],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'zh-TW' }
  ],
  templateUrl: './scheduling.component.html',
  styleUrl: './scheduling.component.scss'
})
export class SchedulingComponent implements OnInit{

  shifts = [
    { name: "Amir Al Azimi", date: "2025/03/04", time: "15:00 - 20:00", role: "外送員", type: "晚班" },
    { name: "Moira Andrews", date: "2025/03/06", time: "13:00 - 20:00", role: "外送員", type: "早班" },
    { name: "Emily Simchenko", date: "2025/03/07", time: "10:00 - 18:00", role: "內場", type: "日班" },
    { name: "Amir Al Azimi", date: "2025/03/04", time: "15:00 - 20:00", role: "外送員", type: "晚班" },
    { name: "Moira Andrews", date: "2025/03/06", time: "13:00 - 20:00", role: "外送員", type: "早班" },
    { name: "Emily Simchenko", date: "2025/03/07", time: "10:00 - 18:00", role: "內場", type: "日班" },
  ];
  


  currentMonthIndex = 0;
  months = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
  
  get currentMonthName() {
    return this.months[this.currentMonthIndex];
  }
  
  avgCheckIn = "9:16";
  avgCheckOut = "5:10";
  avgWorkHr = "8:10";
  
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
    if (this.currentMonthIndex > 0) {
      this.currentMonthIndex--;
    }
  }
  
  nextMonth() {
    if (this.currentMonthIndex < this.months.length - 1) {
      this.currentMonthIndex++;
    }
  }
  
  

  events: DayPilot.EventData[] = [
    { id: '1', start: '2025-09-19T09:00:00', end: '2025-09-19T11:00:00', text: '早班' },
    { id: '2', start: '2025-09-19T13:00:00', end: '2025-09-19T17:00:00', text: '午班' }
  ];

  config: DayPilot.SchedulerConfig = {
    startDate: '2025-09-19',
    days: 1,
    scale: 'Hour',
    cellWidth: 70,
    resources: [
      { name: '員工A', id: 'A' },
      { name: '員工B', id: 'B' }
    ]
  };

  viewMode: 'dashboard' | 'schedule'| 'leave' = 'dashboard'; 

  showSchedule() {
    this.viewMode = 'schedule';   // 進入班表
  }
  
  goHome() {
    this.viewMode = 'dashboard';  // 回首頁
  }

  showLeave() {
    this.viewMode = 'leave';
  }

  punchIn(): void {
    this.dialog.open(ReclockinComponent, {
      panelClass: 'punch-dialog-panel', // 讓 600×600/無滾動 生效
  width: '600px',
  height: '650px',
  maxWidth: 'none',
  autoFocus: false,
  restoreFocus: false,
    });
  }

  ngOnInit(): void {
    
    // 預設助理先打招呼
    this.messages.push({
      sender: 'assistant',
      text: '哈囉！我是您的 AI 助理  今天有什麼可以幫忙的嗎？'
    });
  }

  // ... 其他程式碼保持不變

  title(title: any) {
    throw new Error('Method not implemented.');
  }
  selectedDate: Date | null = null;
  startOfWeek: Date = this.getStartOfWeek(new Date());
  messages: Message[] = [];

  // 時段（範例）
  timeSlots = ['上午 3:30', '上午 4:30', '上午 5:30'];

  constructor(private http: HttpClient,private router:Router,private dialog: MatDialog) {}

  // 取得週日
  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  // 回傳一週的日期陣列
  get weekDays(): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(this.startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }
  
  // 上一週
  prevWeek() {
    this.startOfWeek.setDate(this.startOfWeek.getDate() - 7);
    this.startOfWeek = new Date(this.startOfWeek);
  }
  // 下一週
  nextWeek() {
    this.startOfWeek.setDate(this.startOfWeek.getDate() + 7);
    this.startOfWeek = new Date(this.startOfWeek);
  }

  // 點選日期
  onDateSelected(date: Date) {
    this.selectedDate = date; 
    this.startOfWeek = this.getStartOfWeek(date);
    this.messages = [
      { sender: 'assistant', text: '助理正在生成回覆...' }
    ];
    // 呼叫後端
    this.http.post('http://localhost:8080/api/newtable/ask', {
      selectedDate: date,
      userMessage: `我剛剛選的日期是 ${date.toLocaleDateString('zh-TW')}`
    }).subscribe({
      next: (res: any) => {
        this.messages[0] = {
          sender: 'assistant',
          text: res.assistantReply || 'AI 沒有回覆'
        };
      },
      error: (err) => {
        this.messages[0] = {
          sender: 'assistant',
          text: `API 錯誤：${err.message}`
        };
      }
    });
  }

  openFeedbackDialog() {
    const dialogRef = this.dialog.open(FeedbackDialogComponent, {
      autoFocus: false,
      restoreFocus: false,
      // 讓寬高完全由內容決定（移除預設 80vw 與 maxHeight 限制）
      width: undefined,
      height: undefined,
      maxWidth: 'none',
      maxHeight: 'none',
      panelClass: 'punch-dialog-panel' // 自訂外殼樣式（下面 SCSS 有）
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('使用者填寫的資料:', result);
        // 這裡可以送 API 或顯示訊息
      }
    });
  }

  logout() {
    // 這裡可以做清除登入資訊的動作
    localStorage.clear(); // 或者 sessionStorage.clear();
  
    // 轉跳回登入頁
    this.router.navigate(['/']);
  }

  openAnnouncementDialog() {
    this.dialog.open(AnnouncementDialogComponent, {
      width: '800px',   // 布告欄比較寬
      height: '600px',   // 可以依需求調整
    });
  }
}
