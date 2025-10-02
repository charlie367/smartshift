import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { Router, RouterLink } from '@angular/router';

import { DayPilot, DayPilotModule, DayPilotSchedulerComponent } from '@daypilot/daypilot-lite-angular';

import { FeedbackDialogComponent } from '../feedback-dialog/feedback-dialog.component';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import { ClockComponent } from '../clock/clock.component';
import { WaterdropComponent } from '../waterdrop/waterdrop.component';
import { ReclockinComponent } from '../reclockin/reclockin.component';
import { EmployeeService } from '../@Service/employee.service';
import { HttpErrorResponse } from '@angular/common/http';
import { PreScheduleDialogComponent } from '../pre-schedule-dialog/pre-schedule-dialog.component';
import { MatChipsModule } from '@angular/material/chips';
import { ViewChild } from '@angular/core';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';

type WeekSlot = {
  startTime: string | null;   // '06:00:00'
  endTime: string | null;     // '11:00:00'
  isWorking: boolean;
  isAccept: boolean;
};

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
    MatIconModule,
    MatChipsModule,
    ErrorDialogComponent
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'zh-TW' }],
  templateUrl: './scheduling.component.html',
  styleUrls: ['./scheduling.component.scss'],
})
export class SchedulingComponent implements OnInit {

  @ViewChild('scheduler', { static: false }) scheduler!: DayPilotSchedulerComponent;

  checkingClock = false;

  avgCheckIn: string = '-';
  avgCheckOut: string = '-';
  avgWorkHr: string = '-';
  absentLeaves: string = '0';

  weekSlots: Record<string, WeekSlot[]> = {}
  shifts: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog,
    private employeeService: EmployeeService,
    private cdr: ChangeDetectorRef
  ) {}

  close() {
    const employeeId = localStorage.getItem('employeeId');
    this.dialog.open(PreScheduleDialogComponent, {
      width: '900px',
      height: '700px',
      panelClass: 'no-scroll',
      maxHeight: 'none',
      maxWidth: '100vw', 
      data: { employeeId } 
    });
  }
  dateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }
  
  toHM(t?: string | null): string {
    if (!t) return '—';
    const [h = '00', m = '00'] = t.split(':');
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  ampm(t?: string | null): string {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const isAM = h < 12;
    const h12 = ((h + 11) % 12) + 1;
    return `${isAM ? '上午' : '下午'} ${h12}:${String(m).padStart(2, '0')}`;
  }
  
/** 把當前 this.startOfWeek ~ +6 天的班表塞進 weekSlots */
private toBool(v: any): boolean {
  // 兼容 true/'true'/1/'1'
  return v === true || v === 'true' || v === 1 || v === '1';
}

private parseYMD(s: string): Date {
  // 避免 new Date('YYYY-MM-DD') 的 UTC 偏移
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 把當前 this.startOfWeek ~ +6 天的班表塞進 weekSlots */
loadWeekSlotsForCurrentWeek(): void {
  const employeeId = localStorage.getItem('employeeId');
  if (!employeeId) { this.weekSlots = {}; console.warn('[week] 沒有 employeeId'); return; }

  const start = new Date(this.startOfWeek); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23,59,59,999);

  console.group('[week] 載入本週');
  console.log('employeeId:', employeeId);
  console.log('range:', start, ' ~ ', end);

  this.http.get<any>('http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId', {
    params: { employeeId }
  }).subscribe({
    next: (res) => {
      console.log('API 原始回應:', res);
      const raw: any[] = res?.list ?? res?.preScheduleList ?? res?.preScheduleResList ?? res?.data ?? [];
      console.log('筆數:', raw.length);

      const map: Record<string, WeekSlot[]> = {};
      for (const s of raw) {
        const dateStr: string = (s.applyDate ?? s.apply_date ?? '').slice(0, 10);
        if (!dateStr) continue;

        const d = this.parseYMD(dateStr);
        if (d < start || d > end) continue;

        const isWorking = this.toBool(s.isWorking ?? s.working ?? s.is_working ?? 0);
        const isAccept  = this.toBool(s.isAccept  ?? s.accept  ?? s.is_accept  ?? 0);
        const startTime: string | null = s.startTime ?? s.start_time ?? null;
        const endTime:   string | null = s.endTime   ?? s.end_time   ?? null;

        (map[dateStr] ||= []).push({ startTime, endTime, isWorking, isAccept });
      }

      // 補齊 7 天
      const cur = new Date(start);
      while (cur <= end) {
        const k = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
        map[k] ||= [];
        cur.setDate(cur.getDate() + 1);
      }

      this.weekSlots = map;

      // 把每一天印成表
      Object.keys(map).sort().forEach(k => {
        console.groupCollapsed(`day ${k}`);
        console.table(map[k]);
        console.groupEnd();
      });
      console.groupEnd(); // [week]
    },
    error: (err) => { console.error('[week] API 失敗', err); this.weekSlots = {}; console.groupEnd(); }
  });
}





currentMonthIndex = new Date().getMonth();
months = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

  get currentMonthName() {
    return this.months[this.currentMonthIndex];
  }



  workLogs: any[] = [];


  prevMonth() {
    if (this.currentMonthIndex > 0) {
      this.currentMonthIndex--;
      this.loadClockData();   // ← 加這行
    }
  }
  
  nextMonth() {
    if (this.currentMonthIndex < this.months.length - 1) {
      this.currentMonthIndex++;
      this.loadClockData();   // ← 加這行
    }
  }
  events: DayPilot.EventData[] = [];

  
  
  config: DayPilot.SchedulerConfig = {
    startDate: DayPilot.Date.today(),
    days: 7,
    scale: 'Hour',
    cellWidth: 70,
    resources: []   // 由程式動態塞「我的班表」
  };

  viewMode: 'dashboard' | 'schedule' = 'dashboard';

  selectedDate: Date | null = null;
  startOfWeek: Date = this.getStartOfWeek(new Date());
  messages: Message[] = [];

  // 範例時段


  ngOnInit(): void {
    // 預設助理先打招呼
    this.messages.push({
      sender: 'assistant',
      text: '哈囉！我是您的 AI 助理  今天有什麼可以幫忙的嗎？',
    });

    this.loadClockData();
    this.loadEmployees();
    this.dayTickTimer = setInterval(() => this.ensureNewDay(), 60_000);
    this.loadWeekSlotsForCurrentWeek();

  }


  // 篩掉非上班或未核准的資料
acceptedSlots(list?: WeekSlot[]): WeekSlot[] {
  return (list || []).filter(s => s.isWorking && s.isAccept);
}
trackBySlot = (_: number, s: WeekSlot) => `${s.startTime ?? ''}-${s.endTime ?? ''}`;

// 把 "HH:mm" 或 "HH:mm:ss" 都正規化為 "HH:mm"
private pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
private norm(t?: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(':');
  return `${this.pad2(parseInt(h || '0', 10))}:${this.pad2(parseInt(m || '0', 10))}`;
}

// 顯示範圍字串：HH:mm - HH:mm；若缺任一端就顯示 "—"
formatRange(st?: string | null, et?: string | null): string {
  const s = this.norm(st), e = this.norm(et);
  return (s && e) ? `${s} - ${e}` : '—';
}

// 依起始小時決定 chip 顏色（早/午/夜）
shiftTag(s: WeekSlot): 'morning' | 'afternoon' | 'night' {
  const h = s.startTime ? parseInt(s.startTime, 10) : 0;  // "07:00:00" -> 7
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'night';
}


  private ensureNewDay() {
    const today = this.todayLocal();
    if (today !== this.lastSeenDate) {
      this.lastSeenDate = today;
      this.loadClockData();         // 重新拉後端，workLogs 會變成「今天」
    }
  }
  loadEmployees() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;  
  
    this.http.get<any[]>(`http://localhost:8080/PreSchedule/getThisDaySchedule`, {
      params: { thisDay: today }
    }).subscribe({
      next: (res) => {
        console.log("[today shifts]", res);
        this.shifts = res
        .filter((s: any) => s.working && s.startTime !== "00:00:00" && s.endTime !== "00:00:00")
        .map((s: any) => {
          const formatTime = (t: string) => t ? t.slice(0, 5) : ''; // HH:mm
      
          return {
            name: s.name,
            role: s.title || s.role || '員工',
            // 用換行或空格取代中間的 "-"
            date: `${s.applyDate} ${formatTime(s.startTime)} ~ ${formatTime(s.endTime)}`,
            type: this.getShiftType(s.startTime, s.working)
          };
        });      
      
      },
      error: (err) => {
        console.error("載入當日班表失敗:", err);
        this.shifts = [];
      }
    });
  }
  
  
  // 判斷班別 (早/中/晚/休假)
  private getShiftType(startTime?: string, working?: boolean): string {
    if (!working) return "休假";
    if (!startTime) return "未知";
  
    const h = parseInt(startTime.split(":")[0], 10);
    if (h < 12) return "早班";
    if (h < 18) return "中班";
    return "晚班";
  }
  

  loadClockData() {
    this.http.get<any>('http://localhost:8080/clock/get_all').subscribe({
      next: (res) => {
        if (res.code === 200 && res.clockDateInfoResList) {
          const loginId = localStorage.getItem('employeeId');
          const { firstDay, lastDay } = this.currentMonthWindow();
          const first = new Date(firstDay);
          const last = new Date(lastDay);
  
          const records = res.clockDateInfoResList
            .filter((r: any) => {
              if (loginId && r.employeeId !== loginId) return false;
              const d = new Date(r.workDate);
              return d >= first && d <= last;   // ← 只留在這個月的
            })
            .map((r: any) => ({
              rawDate: r.workDate,
              date: new Date(r.workDate).toLocaleDateString('zh-TW', { weekday:'short', year:'numeric', month:'2-digit', day:'2-digit' }),
              clockOn: r.clockOn || null,
              clockOff: r.clockOff || null,
              totalHour: r.totalHour || null,
              checkIn: r.clockOn || '-',
              checkOut: r.clockOff || '-',
              hours: r.totalHour ? `${r.totalHour} hr` : '-'
            }));
  
          this.workLogs = records;
          records.length > 0 ? this.calcAverages(records) : this.resetAverages();
        }
      }
    });
  }
  private resetAverages(): void {
    this.avgCheckIn = '-';
    this.avgCheckOut = '-';
    this.avgWorkHr = '-';
    this.absentLeaves = '0';
  }
private todayLocal(): string {
  const n = new Date(), p = (x:number)=>x.toString().padStart(2,'0');
  return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
}
private findTodayRecord() {
  const today = this.todayLocal();
  return this.workLogs.find(r => r.rawDate === today) ?? null;
}

  calcAverages(records: any[]) {
    if (!records.length) return;

    // 過濾有上班卡的
    const validClockIns = records.filter(r => r.clockOn);
    const validClockOuts = records.filter(r => r.clockOff);
    const validWorking = records.filter(r => r.totalHour);

    // 平均上班時間
    if (validClockIns.length) {
      const avgInMinutes = Math.floor(
        validClockIns.map(r => this.timeToMinutes(r.clockOn)).reduce((a, b) => a + b, 0) / validClockIns.length
      );
      this.avgCheckIn = this.minutesToTime(avgInMinutes);
    } else {
      this.avgCheckIn = '-';
    }

    // 平均下班時間
    if (validClockOuts.length) {
      const avgOutMinutes = Math.floor(
        validClockOuts.map(r => this.timeToMinutes(r.clockOff)).reduce((a, b) => a + b, 0) / validClockOuts.length
      );
      this.avgCheckOut = this.minutesToTime(avgOutMinutes);
    } else {
      this.avgCheckOut = '-';
    }

    // 平均工時
    if (validWorking.length) {
      const avgHr = (
        validWorking.map(r => r.totalHour || 0).reduce((a, b) => a + b, 0) / validWorking.length
      ).toFixed(2);
      this.avgWorkHr = `${avgHr} hr`;
    } else {
      this.avgWorkHr = '-';
    }

    // 缺勤/請假 (只要 clockOn 和 clockOff 都沒打)
    const absentCount = records.filter(r => !r.clockOn && !r.clockOff).length;
    this.absentLeaves = `${absentCount}`;
  }

  private timeToMinutes(time: string): number {
    if (!time) return 0;
    const [h, m, s] = time.split(':').map(Number);
    return h * 60 + m + (s >= 30 ? 1 : 0); // 秒數 >=30 就進位
  }

  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }
  showSchedule() {
    this.viewMode = 'schedule';
  
    const employeeId = localStorage.getItem('employeeId')!;
    this.config = {
      ...this.config,
      resources: [{ id: employeeId, name: '我的班表' }],
    };
    console.log('[show] employeeId =', employeeId);
    console.log('[show] config.resources =', this.config.resources);
  
    // 視窗切到「下個月」
    const { firstDay, days } = this.currentMonthWindow();
    this.config = { ...this.config, startDate: firstDay, days };
    console.log('[show] window =', { firstDay, days });
  
    // 確保 <daypilot-scheduler> 已經渲染，row 先掛上去
    this.cdr.detectChanges();
  
    // 讀取「已核准」的班表
    this.loadFinalSchedule();
  }
  
  

  private formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  
  private currentMonthWindow() {
    const today = new Date();
    const y = today.getFullYear();             // 先抓今年
    const m = this.currentMonthIndex;          // 用 currentMonthIndex 來決定月份 (0=一月)
  
    const first = new Date(y, m, 1);           // 當月 1 號
    const last  = new Date(y, m + 1, 0);       // 當月最後一天
    const days = Math.round((+last - +first) / 86400000) + 1;
  
    return { 
      firstDay: this.formatDateLocal(first), 
      lastDay: this.formatDateLocal(last),     // 加這個，之後過濾會用到
      days 
    };
  }
  
  
  loadPreSchedule() {
    const employeeId = localStorage.getItem('employeeId');
    if (!employeeId) return;
  
    this.http.get<any>(`http://localhost:8080/PreSchedule/getScheduleByEmployeeId?employeeId=${employeeId}`)
      .subscribe({
        next: (res) => {
          const { firstDay, days } = this.currentMonthWindow();
          const first = new Date(firstDay);
          const last  = new Date(first); last.setDate(first.getDate() + days - 1);
  
          const inRange = (dStr: string) => {
            const d = new Date(dStr);
            return d >= first && d <= last;
          };
  
          const list = (res?.list ?? []).filter((s: any) => inRange(s.applyDate));
  
          this.events = list.map((s: any, i: number) => {
            const date = s.applyDate;
            if (!s.working) {
              return {
                id: i.toString(),
                text: '休假',
                start: new DayPilot.Date(`${date}T00:00:00`),
                end:   new DayPilot.Date(`${date}T23:59:59`),
                resource: employeeId
              } as DayPilot.EventData;
            }
            return {
              id: i.toString(),
              text: `${s.startTime} - ${s.endTime}`,
              start: new DayPilot.Date(`${date}T${s.startTime}`),
              end:   new DayPilot.Date(`${date}T${s.endTime}`),
              resource: employeeId
            } as DayPilot.EventData;
          });
  
          // 視窗再保險定在下個月
          this.config = { ...this.config, startDate: firstDay, days };
  
          //  真的刷新
          this.scheduler?.control.update();
        },
        error: (err) => {
          console.error('載入預排班失敗:', err.message);
          this.events = [];
          this.scheduler?.control.update();
        }
      });
  }
  
  
  loadFinalSchedule() {
    const url = `http://localhost:8080/PreSchedule/getAllSchedule`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        const listRaw: any[] = res?.list ?? res?.preScheduleList ?? [];
        console.log('[final] all schedule:', listRaw);
  
        // 建立所有員工資源
        const employees = new Map<string, string>();
        listRaw.forEach(s => {
          if (!employees.has(s.employeeId)) {
            employees.set(s.employeeId, s.employeeName || `員工${s.employeeId}`);
          }
        });
  
        // 更新左邊的員工列表
        this.config = {
          ...this.config,
          resources: Array.from(employees.entries()).map(([id, name]) => ({ id, name }))
        };
  
        // 建立 events
        this.events = listRaw
        .filter((s: any) => {
          if (!s.working) return true; // 休假永遠保留
          return s.startTime && s.endTime && s.startTime !== "00:00:00" && s.endTime !== "00:00:00";
        })
        .map((s: any, i: number) => {
          if (!s.working) {
            // 休假 → 一整天
            return {
              id: i.toString(),
              text: '休假',
              start: new DayPilot.Date(`${s.applyDate}T00:00:00`),
              end:   new DayPilot.Date(`${s.applyDate}T23:59:59`),
              resource: s.employeeId,
              backColor: '#d3d3d3'
            } as DayPilot.EventData;
          }
          // 上班 → 綠色
          return {
            id: i.toString(),
            text: `${s.startTime} - ${s.endTime}`,
            start: new DayPilot.Date(`${s.applyDate}T${s.startTime}`),
            end:   new DayPilot.Date(`${s.applyDate}T${s.endTime}`),
            resource: s.employeeId,
            backColor: '#90ee90'
          } as DayPilot.EventData;
        });
  
        // 更新畫面
        setTimeout(() => this.scheduler?.control.update(), 0);
      },
      error: (err) => {
        console.error('[final] API error:', err);
        this.events = [];
        this.scheduler?.control.update();
      }
    });
  }
  
  

  
  private lastSeenDate = this.todayLocal();
private dayTickTimer: any;

  goHome() {
    this.viewMode = 'dashboard';
  }
  punchIn(): void {
    const employeeId = localStorage.getItem('employeeId') || '';
    const workDate = this.todayLocal();

    // 先詢問後端今天可不可以上班打卡
    this.http.post<any>('http://localhost:8080/clock/fix/check', { employeeId, workDate })
      .subscribe({
        next: (res) => {
          const status = res?.status;  // NO_WORK / MISS_TWO / MISS_OFF / MISS_ON / IS_OK

          // 不可上班 → 直接跳你的錯誤 Dialog（固定文字：今日未排班）
          if (status === 'NO_WORK') {
            this.dialog.open(ErrorDialogComponent, {
              width: '280px',
              panelClass: 'no-padding-dialog',
              disableClose: true,
              data: { message: '今日未排班' }
            });
            return;
          }

          // 可以上班 → 照原本流程打開打卡視窗
          const today = this.findTodayRecord();
          const dialogRef = this.dialog.open(ReclockinComponent, {
            panelClass: 'punch-dialog-panel',
            width: '600px',
            height: '650px',
            maxWidth: 'none',
            autoFocus: false,
            restoreFocus: false,
            data: today
              ? { workDate: today.rawDate, clockOn: today.clockOn, clockOff: today.clockOff }
              : { workDate: this.todayLocal() }
          });

          // 關閉後刷新
          dialogRef.afterClosed().subscribe(() => this.loadClockData());
        },
        error: () => {
          // 後端掛了就不擋，或改成彈錯誤也行
          this.dialog.open(ErrorDialogComponent, {
            data: { message: '系統忙線中，請稍後重試' }
          });
        }
      });
  }

  // todayLocal() 與 findTodayRecord() 你已經有，保留即可

  
  
  

  // 取得當週週日
  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // 週日為週首
    d.setHours(0, 0, 0, 0);              // ★ 歸零時間
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
    this.startOfWeek.setHours(0, 0, 0, 0);   // ★
    this.startOfWeek = new Date(this.startOfWeek);
    this.loadWeekSlotsForCurrentWeek();
  }
  nextWeek() {
    this.startOfWeek.setDate(this.startOfWeek.getDate() + 7);
    this.startOfWeek.setHours(0, 0, 0, 0);   // ★
    this.startOfWeek = new Date(this.startOfWeek);
    this.loadWeekSlotsForCurrentWeek();
  }
  
  onDateSelected(date: Date) {
    this.selectedDate = date;
    this.startOfWeek = this.getStartOfWeek(date);

    this.loadWeekSlotsForCurrentWeek();  

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
        error: (err: HttpErrorResponse) => {
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
