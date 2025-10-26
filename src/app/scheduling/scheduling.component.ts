import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ElementRef ,ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
import { MatBadgeModule } from '@angular/material/badge';
import { Testneed1Component } from '../calendar/testneed1.component';
import { forkJoin, of } from 'rxjs';  

type WeekSlot = {
  startTime: string | null;   // '06:00:00'
  endTime: string | null;     // '11:00:00'
  isWorking: boolean;
  isAccept: boolean;
  shiftWorkId?: number; 
};

interface Message {
  sender: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-scheduling',
  standalone: true,
  imports: [
    MatBadgeModule,
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
    MatChipsModule,
    ErrorDialogComponent,
    Testneed1Component
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'zh-TW' }],
  templateUrl: './scheduling.component.html',
  styleUrls: ['./scheduling.component.scss'],
})
export class SchedulingComponent implements OnInit {

  public config!: DayPilot.SchedulerConfig;   // 先宣告欄位（有 ! 表示稍後一定會賦值）
  public events: DayPilot.EventData[] = []; 

  hidden = false;

  toggleBadgeVisibility() {
    this.hidden = !this.hidden;
  }

  //是用來生成變數好控制畫面的渲染
  @ViewChild('scheduler', { static: false }) scheduler!: DayPilotSchedulerComponent;

  @ViewChild('chatBox', { static: false }) chatBoxRef!: ElementRef<HTMLDivElement>;
  checkingClock = false;

  avgCheckIn: string = '-';
  avgCheckOut: string = '-';
  avgWorkHr: string = '-';
  absentLeaves: string = '0';
  unreadCount = 0;
  weekSlots: Record<string, WeekSlot[]> = {}
  shifts: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private dialog: MatDialog,
    private employeeService: EmployeeService,
    private cd: ChangeDetectorRef
  ) {}

// 接住 testneed1 的區間事件；需要時再做事
onRangeChange(evt: { start: Date | null; end: Date | null }) {
  console.log('[rangeChange]', evt);

  // 如果你想在選到區間時，也觸發既有流程，可以用 start 當代表：
  if (evt.start) {
    this.onDateSelected(evt.start);
  }
}

openAnnouncementDialog() {
  const dialogRef = this.dialog.open(AnnouncementDialogComponent, {
    width: '800px',
    height: '600px',
    panelClass: ['no-scroll', 'ann-dialog'],
    disableClose: true,             
  });

  // 不管子層回什麼，關閉後一律「重算徽章」
  dialogRef.afterClosed().subscribe(() => {
    this.recountUnread();          // ② 關閉就重算（見下方實作）
  });
}

/** 重新計算未讀數（公佈欄 + 個人通知） */
private recountUnread() {
  const employeeId = (localStorage.getItem('employeeId') || '').trim();

  // 讀取本地已讀清單
  const readPublic = new Set<number>(
    JSON.parse(localStorage.getItem('readNotices') || '[]').map((x: any) => Number(x))
  );
  const readPersonal = new Set<number>(
    JSON.parse(localStorage.getItem(`readPersonalNotices_${employeeId}`) || '[]').map((x: any) => Number(x))
  );

  // 取最新列表後計算差集
  forkJoin({
    pub: this.http.get<any>('http://localhost:8080/notify/searchTrueAll'),
    per: employeeId
      ? this.http.get<any>('http://localhost:8080/get/employeeNotify', { params: { employeeId } })
      : of({}),
  }).subscribe(({ pub, per }) => {
    const pubIds = (pub?.notifyList ?? []).map((n: any) => Number(n.id));
    const perRaw =
      per?.employeeNotifyList ?? per?.employee_notify_list ?? per?.list ?? per?.data ?? [];
    const perIds = (perRaw as any[]).map((n: any) => Number(n.id));

    const publicUnread   = pubIds.filter((id: number) => !readPublic.has(id)).length;
    const personalUnread = perIds.filter((id: number) => !readPersonal.has(id)).length;
    

    this.unreadCount = publicUnread + personalUnread;
  });
}

  
  punchIn(): void {
    const employeeId = (localStorage.getItem('employeeId') || '').toString().trim();
    const workDate = this.todayLocal();
  
      // 這裡先讀 DEV_CLOCK
  const devClock = localStorage.getItem("DEV_CLOCK");
  console.log("[punchIn] DEV_CLOCK=", devClock);

  // 如果有 DEV_CLOCK，就用它當打卡時間；否則用現在時間
  const nowTime = devClock || new Date().toTimeString().slice(0,8);
  console.log("[punchIn] nowTime (送給後端) =", nowTime);
    // 班段（保持原本邏輯）
    const key = this.dateKey(new Date(workDate));
    const raw = this.weekSlots[key] || [];
    const shifts = this.acceptedSlots(raw).map(s => ({
      start_time: s.startTime!,
      end_time:   s.endTime!,
      shift_work_id: Number(s.shiftWorkId ?? 0)
    }));
    console.table(shifts);
    console.log('[punchIn] employeeId:', employeeId, 'workDate:', workDate);
    console.log('[punchIn] shifts for today:', shifts);
  
    this.http.get<any>('http://localhost:8080/all').subscribe({
      next: (all) => {
        console.log('[punchIn] /clock/all raw:', all);
  
        const list = all?.clockDateInfoResList ?? all?.data ?? all?.list ?? [];
        console.log('[punchIn] list length:', list.length);
        if (list.length) {
          // 先用 table 看全部欄位長怎樣
          console.table(list);
        }
  
        // 顯示每筆的 employeeId / workDate 型別，抓型別不一致的問題（數字 vs 字串）
        list.slice(0, 10).forEach((r: any, i: number) => {
          console.log(
            `[punchIn] row#${i}`,
            'employeeId=', r.employeeId, `(${typeof r.employeeId})`,
            'workDate=', r.workDate, `(${typeof r.workDate})`,
            'clockOn=', r.clockOn, 'clockOff=', r.clockOff
          );
        });
  
        // 這裡也把比對條件印出來，避免日期格式不同（例如 '2025-10-17' vs '2025/10/17'）
        const todayRec = list.find((r: any) => {
          const empOk = String(r.employeeId).trim() === employeeId;
          const dateOk = String(r.workDate).slice(0, 10) === workDate; // 防止有時間成分
          if (!empOk || !dateOk) {
            // 想更吵就打開這行
            // console.log('[punchIn] skip row:', r.employeeId, r.workDate, '=> empOk:', empOk, 'dateOk:', dateOk);
          }
          return empOk && dateOk;
        }) || null;
  
        console.log('[punchIn] matched todayRec:', todayRec);
  
        const dialogRef = this.dialog.open(ReclockinComponent, {
          width: '600px',
          height: '650px',
          data: {
            workDate,
            clockOn:   todayRec?.clockOn   ?? null,
            clockOff:  todayRec?.clockOff  ?? null,
            restStart: todayRec?.restStart ?? null,  
            restEnd:   todayRec?.restEnd   ?? null,   
            shifts,
            nowTime
          }
        });
  
        dialogRef.afterClosed().subscribe((v) => {
          console.log('[punchIn] dialog closed, refresh flag:', v);
          this.loadClockData();
        });
      },
      error: (err) => {
        console.error('[punchIn] /clock/all error:', err);
        this.dialog.open(ErrorDialogComponent, {
          data: { message: '無法讀取打卡紀錄' }
        });
      }
    });
  }
  
  monthQuotaHours = 160;  
  workedHours = 0;      
  waterLevel = 0;  

  loadClockData() {
    this.http.get<any>('http://localhost:8080/all').subscribe({
      next: (res) => {
        const loginId = String(localStorage.getItem('employeeId') || '').trim();
  
        // ✅ 本地安全邊界：當月 1 號 00:00 ~ 月末 23:59:59.999
        const y = this.currentMonth.getFullYear();
        const m = this.currentMonth.getMonth();
        const first = new Date(y, m, 1, 0, 0, 0, 0);
        const last  = new Date(y, m + 1, 0, 23, 59, 59, 999);
  
        const rawList = res.clockDateInfoResList ?? res.data ?? res.list ?? [];
  
        const records = rawList
          .filter((r: any) => {
            const empOk = String(r.employeeId).trim() === loginId;
            const dStr = String(r.workDate || r.date || r.applyDate).slice(0, 10);
            const d = this.parseYMD(dStr);          // ✅ 不用 new Date('YYYY-MM-DD')
            return empOk && d >= first && d <= last; // ✅ 不會漏月底
          })
          .map((r: any) => {
            const workDate = r.workDate || r.date || r.applyDate;
            const clockOn  = r.clockOn  || r.onTime  || r.checkIn;
            const clockOff = r.clockOff || r.offTime || r.checkOut;
            const hours    = r.totalHour ?? r.workHours ?? r.hours;
  
            return {
              rawDate: workDate,
              date: this.parseYMD(String(workDate).slice(0,10))
                      .toLocaleDateString('zh-TW', { weekday:'short', year:'numeric', month:'2-digit', day:'2-digit' }),
              clockOn,
              clockOff,
              restStart: r.restStart || r.breakStart || null,
              restEnd:   r.restEnd   || r.breakEnd   || null,
              totalHour: hours,
              checkIn: clockOn  || '-',
              checkOut: clockOff || '-',
              hours: hours ? hours + "hr" : '-'
            };
          });
  
        this.workLogs = records;
  
        if (records.length) this.calcAverages(records);
        else this.resetAverages();
        this.workLogsReady = true;   // 分子算好了
        this.recomputeWater();
      },
      error: () => {
        this.workLogs = [];
this.resetAverages();
this.workLogsReady = true;
this.recomputeWater();

      }
    });
  }
  
  private updateWaterLevel(records: any[]) {
    let totalMin = 0;
  
    for (const r of records) {
      if (r.totalHour != null && !isNaN(Number(r.totalHour))) {
        totalMin += Math.round(Number(r.totalHour) * 60);
        continue;
      }
      if (!r.clockOn || !r.clockOff) continue;
  
      const inM  = this.timeToMinutes(r.clockOn);
      const outM = this.timeToMinutes(r.clockOff);
      let dur = outM - inM;
      if (dur < 0) dur += 24 * 60;
  
      if (r.restStart && r.restEnd) {
        let rs = this.timeToMinutes(r.restStart);
        let re = this.timeToMinutes(r.restEnd);
        let rest = re - rs;
        if (rest < 0) rest += 24 * 60;
        dur -= Math.max(0, rest);
      }
      totalMin += Math.max(0, dur);
    }
  
    this.workedHours = +(totalMin / 60).toFixed(1);
  
    const denom = Number(this.monthQuotaHours);
    if (!isFinite(denom) || denom <= 0) {
      this.waterLevel = 0; // 分母還沒好 → 先顯示 0%
      return;
    }
    const lvl = Math.round(Math.min(100, Math.max(0, (this.workedHours / denom) * 100)));
    this.waterLevel = lvl;
  }
  

  /** 若要啟用「準時才算」，可用 weekSlots 抓當天第一段上班起點 */
  private getScheduleStartForDate(ymd: string): string | null {
    const list = this.weekSlots[ymd] || [];
    const ok = list.filter(s => s.isWorking && s.isAccept && s.startTime);
    if (!ok.length) return null;
    // 取最早開始的一段
    const first = ok.map(s => s.startTime!).sort()[0];
    return first; // 'HH:mm:ss' or 'HH:mm'
  }
  

  private findTodayRecord() {
    const today = this.todayLocal();
    return this.workLogs.find(r => r.rawDate === today) ?? null;
  }
  
  workLogs: any[] = [];
  
    private todayLocal(): string {
      const n = new Date(), p = (x:number)=>x.toString().padStart(2,'0');
      return n.getFullYear() + "-" + p(n.getMonth() + 1) + "-" + p(n.getDate());
      ;
    }


  calcAverages(records: any[]) {
 if (records.length === 0) return;

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
      //數字 無條件捨去（往下取整數）
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
        validWorking.map(r => r.totalHour ).reduce((a, b) => a + b, 0) / validWorking.length
        //四捨五入到小數點後 1 位
      ).toFixed(1);
      this.avgWorkHr = avgHr + " hr";
    } else {
      this.avgWorkHr = '-';
    }

    // 缺勤/請假 (只要 clockOn 和 clockOff 都沒打)
    const absentCount = records.filter(r => !r.clockOn && !r.clockOff).length;
    this.absentLeaves = absentCount+"天";
  }

//把分鐘換算成小時+分鐘
  private minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return h + ":" + m;
  }
//把小時換成分鐘
  private timeToMinutes(time: string): number {
    if (!time) return 0;
    //split(':') 的作用就是 把字串按照 : 這個符號切開，變成一個陣列。
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m ;
  }

//全部歸零
  private resetAverages(): void {
    this.avgCheckIn = '-';
    this.avgCheckOut = '-';
    this.avgWorkHr = '-';
    this.absentLeaves = '0';
  }

time: any[] = [];



  months = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];





  close() {
    const employeeId = localStorage.getItem('employeeId');
    this.dialog.open(PreScheduleDialogComponent, {
      width: '900px',
      height: '700px',
      panelClass: 'no-scroll',
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
      const raw: any[] = res?.preScheduleList ?? res?.list ?? res?.preScheduleResList ?? res?.data ?? [];
      console.log('筆數:', raw.length);

      const map: Record<string, WeekSlot[]> = {};
      for (const s of raw) {
        const dateStr: string = (s.applyDate ?? s.apply_date ?? '').slice(0, 10);
        if (!dateStr) continue;

        const d = this.parseYMD(dateStr);
        if (d < start || d > end) continue;

        const isWorking = Number(s.shiftWorkId ?? s.shift_work_id ?? 0) > 0;

        // 後端欄位是 accept(boolean)，轉成前端慣用的 isAccept
        const isAccept  = (s.accept ?? s.isAccept ?? s.is_accept) === true || (s.accept ?? s.isAccept ?? s.is_accept) === 1 || (s.accept ?? s.isAccept ?? s.is_accept) === '1';

        const startTime: string | null = (s.startTime ?? s.start_time ?? null) ? String(s.startTime ?? s.start_time).slice(0,8) : null;
        const endTime:   string | null = (s.endTime   ?? s.end_time   ?? null) ? String(s.endTime   ?? s.end_time).slice(0,8) : null;

        const shiftWorkId = Number(s.shiftWorkId ?? s.shift_work_id ?? 0);

        (map[dateStr] ||= []).push({ startTime, endTime, isWorking, isAccept,shiftWorkId  });
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


get currentMonthLabel(): string {
  const y = this.currentMonth.getFullYear();
  const m = this.currentMonth.getMonth() + 1;
  return `${y} 年 ${m.toString().padStart(2, '0')} 月`;
}


  viewMode: 'dashboard' | 'schedule' = 'dashboard';

  selectedDate: Date | null = null;
  startOfWeek: Date = this.getStartOfWeek(new Date());
  messages: { sender: 'user' | 'assistant'; text: string; time?: string }[] = [];
  userInput="";
  sending=false;
  // 範例時段
/** 只用靜態資料驗證畫面是否能渲染 */
private debugPopulateStatic(): void {
  const start = '2025-10-01';
  const days = 31;

  // ⚠️ 重新指派整個 config，強制帶入 startDate/days
  this.config = {
    scale: 'Day',
    cellWidth: 50,
    rowHeaderWidth: 150,
    timeHeaders: [{ groupBy: 'Day', format: 'd' }],
    startDate: new DayPilot.Date(start),
    days,
    heightSpec: 'Fixed',
    height: 520,
    resources: [
      { id: 'e1', name: '測試員工 A（正職）' },
      { id: 'e2', name: '測試員工 B（計時）' },
    ],
    onBeforeEventRender: (args) => {
      const txt = String(args.data.text ?? '');
      const first = txt.split('｜')[0]?.trim() || '休';
      const colorMap: Record<string, string> = {
        '早':'#E3F2FD','中':'#FFF8E1','晚':'#E8F5E9','夜':'#E1BEE7','休':'#FFEBEE'
      };
      args.data.html = `<div class="shift-box" style="background:${colorMap[first] ?? '#ECEFF1'}">${txt}</div>`;
    }
  } as DayPilot.SchedulerConfig;

  this.events = [
    { id: 'e1-2025-10-03', text: '早｜晚', start: new DayPilot.Date('2025-10-03T00:00:00'), end: new DayPilot.Date('2025-10-03T23:59:59'), resource: 'e1', fontColor:'black' },
    { id: 'e2-2025-10-04', text: '休',     start: new DayPilot.Date('2025-10-04T00:00:00'), end: new DayPilot.Date('2025-10-04T23:59:59'), resource: 'e2', fontColor:'black' },
  ];

  console.log('[CHECK] startDate=', this.config.startDate?.toString(), 'days=', this.config.days);
  console.log('[CHECK] resources=', this.config.resources?.length, 'events=', this.events.length);

  setTimeout(() => this.scheduler?.control.update(), 0);
}


  ngOnInit(): void {
  
    // ① DayPilot 基本設定（含配色）
    this.config = {
      scale: 'Day',
      cellWidth: 50,
      rowHeaderWidth: 150,
      resources: [],
      timeHeaders: [{ groupBy: 'Day', format: 'd' }],
      eventMoveHandling: 'Disabled',
      eventResizeHandling: 'Disabled',
      eventClickHandling: 'Disabled',
      onBeforeEventRender: (args) => {
        const txt = String(args.data.text ?? '');
        const first = txt.split('｜')[0]?.trim() || '休';
        const colorMap: Record<string, string> = {
          '早': '#E3F2FD',
          '中': '#FFF8E1',
          '晚': '#E8F5E9',
          '夜': '#E1BEE7',
          '休': '#FFEBEE',
        };
        const bgColor = colorMap[first] ?? '#ECEFF1';
        args.data.cssClass = 'shift-event';
        args.data.html = `<div class="shift-box" style="background-color:${bgColor}">${txt}</div>`;
      }
    } as DayPilot.SchedulerConfig;
  
    // ② 立刻把時間窗鎖定到「本月」（關鍵：重新指派 config）
    const { firstDay, days } = this.currentMonthWindow();
    this.config = {
      ...this.config,
      startDate: new DayPilot.Date(firstDay),
      days
    };
  
    // ③ 其他初始化（你原本就有的）
    this.messages.push({
      sender: 'assistant',
      text: '哈囉！我是您的 AI 助理，今天有什麼可以幫忙的嗎？',
    });
  
    this.monthQuotaReady = false;
    this.workLogsReady   = false;
    this.recalcMonthQuotaHours(); // 分母
    this.loadClockData();   
    this.loadEmployees();
    this.loadWeekSlotsForCurrentWeek();
    this.recountUnread();


    this.dayTickTimer = setInterval(() => this.ensureNewDay(), 60_000);
  }
  
  private setMonthWindow() {
    const { firstDay, days } = this.currentMonthWindow();
    this.config = {
      ...(this.config ?? {}),
      scale: 'Day',
      cellWidth: 50,
      rowHeaderWidth: 150,
      timeHeaders: [{ groupBy: 'Day', format: 'd' }],
      startDate: new DayPilot.Date(firstDay),
      days,
      widthSpec: 'Parent100Pct', // ★ 關鍵：吃父層 100% 寬
      heightSpec: 'Auto',       // ★ 關鍵：固定高度
    } as DayPilot.SchedulerConfig;
  }
  
  private toEvents(res: any): DayPilot.EventData[] {
    const { firstDay, lastDay } = this.currentMonthWindow();
    const inMonth = (d: string) => d >= firstDay && d <= lastDay;
  
    const id2txt = (id: number) =>
      id === 0 ? '休' : id === 1 ? '早' : id === 2 ? '中' : id === 3 ? '晚' : id === 4 ? '夜' : '';
  
    const events: DayPilot.EventData[] = [];
    (res.employeeList ?? []).forEach((emp: any) => {
      (emp.date ?? []).forEach((d: any) => {
        const apply = String(d.applyDate).slice(0,10);
        if (!inMonth(apply)) return;
  
        let shifts = (d.shiftDetailList ?? [])
          .filter((s: any) => s.accept)
          .map((s: any) => id2txt(s.shiftWorkId))
          .filter(Boolean);
  
        if (shifts.includes('休')) shifts = ['休'];
        if (!shifts.length) return;
  
        events.push({
          id: `${emp.employeeId}-${apply}`,
          text: shifts.join('｜'),
          start: new DayPilot.Date(`${apply}T00:00:00`),
          end:   new DayPilot.Date(`${apply}T23:59:59`),
          resource: String(emp.employeeId),          // ✅ 型別一致
          fontColor: 'black'
        });
      });
    });
    return events;
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
        .filter((s: any) => (Number(s.shiftWorkId ?? 0) > 0) && s.startTime !== "00:00:00" && s.endTime !== "00:00:00")
        .map((s: any) => {
          const formatTime = (t: string) => t ? String(t).slice(0, 5) : ''; // HH:mm
          return {
            name: s.name,
            role: s.title || s.role || '員工',
            date: `${s.applyDate} ${formatTime(s.startTime)} ~ ${formatTime(s.endTime)}`,
            type: this.getShiftType(s.startTime, s.shiftWorkId)
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
// 判斷班別 (早/中/晚/休假)
private getShiftType(startTime?: string, shiftWorkId?: number): string {
  if (!shiftWorkId || shiftWorkId === 0) return "休假";
  if (!startTime) return "未知";
  const h = parseInt(String(startTime).split(":")[0], 10);
  if (h < 12) return "早班";
  if (h < 18) return "中班";
  return "晚班";
}

  goHome() {
    this.viewMode = 'dashboard';
  }

  logout() {
    this.router.navigate(['/']);
  }

/** 把 Scheduler 調成「月檢視」並設定顏色渲染 */

loadFinalSchedule() {
  this.http.get<any>('http://localhost:8080/PreSchedule/prettySchedule').subscribe({
    next: (res) => {
      // 先組 resources（一定要在 config 上重新指派）
      const resources = (res.employeeList ?? []).map((emp: any) => ({
        id: String(emp.employeeId),
        name: emp.name ? `${emp.name}${emp.title ? '（' + emp.title + '）' : ''}` : String(emp.employeeId)
      }));

      this.config = { ...(this.config ?? {}), resources };

      // 再組 events，一次性指派（Angular 會偵測）
      this.events = this.toEvents(res);

      // 保險再把時間窗鎖定當月（重新指派）
      this.setMonthWindow();

      // 等 *ngIf 建好元件後再請 DayPilot 重繪一次（不是必要，但更穩）
      setTimeout(() => this.scheduler?.control.update(), 0);
      
    },
    error: (err) => {
      console.error('prettySchedule 失敗:', err);
      this.events = [];
      setTimeout(() => this.scheduler?.control.update(), 0);
    }
  });
}




showSchedule() {
  this.viewMode = 'schedule';
  this.setMonthWindow();     // 先建立月時間軸 + 寬高
  this.loadFinalSchedule();  // 再塞 resources + events
  setTimeout(() => this.scheduler?.control.update(), 0);
}
  //切換下一個月的方法
currentMonth = new Date();  // 取代 currentMonthIndex

private currentMonthWindow() {
  const y = this.currentMonth.getFullYear();
  const m = this.currentMonth.getMonth();
  const first = new Date(y, m, 1);
  const last  = new Date(y, m + 1, 0);
  return {
    firstDay: this.formatDateLocal(first),
    lastDay:  this.formatDateLocal(last),
    days:     last.getDate(),
  };
}

prevMonth() {
  this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
  this.setMonthWindow();
  this.loadFinalSchedule();
  this.monthQuotaReady = false;
  this.workLogsReady   = false;
  this.recalcMonthQuotaHours();
  this.loadClockData();
}

private monthQuotaReady = false; // 分母是否算好
private workLogsReady   = false; // 分子是否算好

private recomputeWater() {
  if (!this.monthQuotaReady || !this.workLogsReady) return;
  this.updateWaterLevel(this.workLogs);
}

nextMonth() {
  this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
  this.setMonthWindow();
  this.loadFinalSchedule();
  this.monthQuotaReady = false;
  this.workLogsReady   = false;
  this.recalcMonthQuotaHours();
  this.loadClockData();
}


  //從數字轉成字串讓後端可以接收
  private formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + "-" + m + "-" + day;
  }
  
// scheduling.component.ts
get uiLevel(): number {
  const real = Math.round(Math.min(100, Math.max(0, this.waterLevel)));
  if ((this.workedHours ?? 0) <= 0) {
    // 本月完全沒工時 → 顯示 0%，不要套最小水位
    return 0;
  }
  const MIN = 15;  // 你要的最低顯示百分比
  return Math.max(MIN, real);
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
  
  private lastSeenDate = this.todayLocal();
private dayTickTimer: any;


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
    console.log("onDateSelected", date);
    this.selectedDate = date;
    this.startOfWeek = this.getStartOfWeek(date);
  
    // 先刷新當週班表
    this.loadWeekSlotsForCurrentWeek();
  
    // 將聊天框先清空，顯示 loading
    this.messages = [{ sender: 'assistant', text: '正在查詢該天排班...' }];
  
    // 日期 key，用於查 weekSlots
    const dateKey = this.dateKey(date);
  
    // 抓該天班表
    const slots = this.weekSlots[dateKey] || [];
  
    let replyText = '';
  
    if (!slots.length) {
      replyText = `${date.toLocaleDateString('zh-TW')} 沒有排班紀錄`;
    } else {
      replyText = `${date.toLocaleDateString('zh-TW')} 排班如下：\n`;
      slots.forEach((s, i) => {
        if (!s.isWorking || !s.isAccept) {
          replyText += `第${i + 1}班：休假\n`;
        } else {
          const start = this.toHM(s.startTime);
          const end = this.toHM(s.endTime);
          replyText += `第${i + 1}班：${start} - ${end}\n`;
        }
      });
    }
  
    // 將結果更新到聊天框
    this.messages[0] = { sender: 'assistant', text: replyText };
  
    // 滾動到底
    setTimeout(() => this.scrollChatToBottom(), 50);
  }
  
  scrollChatToBottom(behavior: ScrollBehavior = 'smooth') {
    try {
      // 1) 優先使用 ViewChild（Angular reference）
      const el = (this.chatBoxRef && this.chatBoxRef.nativeElement)
                 ? this.chatBoxRef.nativeElement
                 : document.querySelector('.chat-box') as HTMLElement | null;
  
      if (!el) {
        // fallback: 找到 chat-box 的最後一則訊息，scrollIntoView
        const last = document.querySelector('.chat-box .chat-row:last-child');
        if (last) {
          (last as HTMLElement).scrollIntoView({ behavior });
        }
        return;
      }
  
      // 2) 確保 Angular 已更新 DOM（呼叫 detectChanges 可幫忙）
      try { this.cd?.detectChanges(); } catch (e) { /* ignore if cd not injected */ }
  
      // 3) 等一個微 task（確保 DOM 完全渲染），再滾動
      setTimeout(() => {
        el.scrollTo({
          top: el.scrollHeight,
          behavior
        });
      }, 0);
    } catch (e) {
      console.error('scrollChatToBottom failed:', e);
    }
  }
  
sendMessage(): void {

  const text = (this.userInput || '').trim();
  if (!text) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

  console.log('sendMessage called', text);

  // 1) 立即把 user 訊息顯示
  this.messages.push({ sender: 'user', text, time: timeStr });

  // 2) 清空輸入框並鎖定
  this.userInput = '';
  this.sending = true;

  // 3) 在最後加一個 loading 訊息，記住索引
  this.messages.push({ sender: 'assistant', text: '助理正在生成回覆...', time: timeStr });
  const loadingIndex = this.messages.length - 1;

  // 先滾一次到最底，顯示 user 訊息與 loading
  setTimeout(() => this.scrollChatToBottom('auto'), 0);

  // 4) 組 payload 並送出
  const employeeId = localStorage.getItem('employeeId') || '';
  const selectedDateStr = this.formatDateTimeLocal(now);

  const payload = {
    employeeId: employeeId,
    userMessage: text,
    selectedDate: selectedDateStr
  };

  this.http.post<any>('http://localhost:8080/api/newtable/ask', payload)
    .subscribe({
      next: (res) => {
        const aiText = res?.assistantReply ?? res?.reply ?? 'AI 沒回覆';
        const aiTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

        // 5) 用 AI 回覆替換剛剛的 loading 訊息（保留順序）並加上時間
        this.messages[loadingIndex] = { sender: 'assistant', text: aiText, time: aiTime };

        // 6) 解除鎖定並滾到底（用平滑效果）
        this.sending = false;
        this.cd.detectChanges();
        setTimeout(() => this.scrollChatToBottom('smooth'), 50);
      },
      error: (err: HttpErrorResponse) => {
        const errTime = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        this.messages[loadingIndex] = { sender: 'assistant', text: `系統錯誤：${err.message}`, time: errTime };
        this.sending = false;
        this.cd.detectChanges();
        setTimeout(() => this.scrollChatToBottom('smooth'), 50);
      }
    });

}

/** 依當前 this.currentMonth 動態計算「本月總時數」= 已核准班表的總工時（小時） */
private recalcMonthQuotaHours() {
  const employeeId = localStorage.getItem('employeeId');
  if (!employeeId) { this.monthQuotaHours = 0; this.updateWaterLevel(this.workLogs); return; }

  // 本月安全邊界
  const y = this.currentMonth.getFullYear();
  const m = this.currentMonth.getMonth();
  const first = new Date(y, m, 1, 0, 0, 0, 0);
  const last  = new Date(y, m + 1, 0, 23, 59, 59, 999);

  this.http.get<any>('http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId', {
    params: { employeeId }
  }).subscribe({
    next: (res) => {
      const list: any[] = res?.preScheduleList ?? res?.preScheduleResList ?? res?.list ?? res?.data ?? [];
      let totalMin = 0;

      for (const s of list) {
        const dStr = String(s.applyDate ?? s.apply_date ?? '').slice(0, 10);
        if (!dStr) continue;
        const d = this.parseYMD(dStr);
        if (d < first || d > last) continue;

        const isWorking = Number(s.shiftWorkId ?? s.shift_work_id ?? 0) > 0;
        const isAccept  = this.toBool(s.accept ?? s.isAccept ?? s.is_accept);
        if (!isWorking || !isAccept) continue;

        const st = (s.startTime ?? s.start_time) ? String(s.startTime ?? s.start_time).slice(0,8) : null;
        const et = (s.endTime   ?? s.end_time)   ? String(s.endTime   ?? s.end_time).slice(0,8)   : null;
        if (!st || !et) continue;

        let sMin = this.timeToMinutes(st);
        let eMin = this.timeToMinutes(et);
        let dur  = eMin - sMin;
        if (dur < 0) dur += 24 * 60;   // 跨日（如 20:00~00:00）
        totalMin += Math.max(0, dur);
      }

      // 你可改成 +(totalMin/60).toFixed(1) 取到 1 位小數
      this.monthQuotaHours = Math.round(totalMin / 60);
      // 重新計算水滴百分比（因為分母變了）
      this.monthQuotaReady = true; // 分母算好了
this.recomputeWater();
    },
    error: () => {
      this.monthQuotaHours = 0;
      this.updateWaterLevel(this.workLogs);
    }
  });
}


formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2,'0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${sec}`;
}

  openFeedbackDialog() {
    const dialogRef = this.dialog.open(FeedbackDialogComponent, {
      autoFocus: false,
      width: undefined,
      height: undefined,
      maxWidth: 'none',
      maxHeight: 'none',
    });
  }



}
