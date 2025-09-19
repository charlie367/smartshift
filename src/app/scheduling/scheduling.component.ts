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
    MatButtonModule, MatCalendar, CalendarModule, HttpClientModule, MatTabsModule, MatIconModule,ClockComponent,WaterdropComponent,],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'zh-TW' }
  ],
  templateUrl: './scheduling.component.html',
  styleUrl: './scheduling.component.scss'
})
export class SchedulingComponent implements OnInit{

  viewMode: 'dashboard' | 'schedule' = 'dashboard';

showSchedule() {
  this.viewMode = 'schedule';
}

showDashboard() {
  this.viewMode = 'dashboard';
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
      width: '650px',
      height: '610px',
      maxHeight: '100vh',
      maxWidth: '100vw'
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
