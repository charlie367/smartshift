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
import { MatBadgeModule } from '@angular/material/badge';

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
    ErrorDialogComponent
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
  ) {}


  openAnnouncementDialog() {
    const dialogRef = this.dialog.open(AnnouncementDialogComponent, {
      width: '800px',
      height: '600px',
    });
  
    // 視窗關閉後標記已讀
    dialogRef.afterClosed().subscribe(() => {
      this.markAllAsRead();
    });
  }
  markAllAsRead() {
    this.http.get<any>('http://localhost:8080/notify/searchAll').subscribe({
      next: (res) => {
        const ids = (res?.notifyList ?? []).map((n: any) => n.id);
        localStorage.setItem('readNotices', JSON.stringify(ids));
        this.unreadCount = 0;
      }
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
      end_time:   s.endTime!
    }));
  
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
  
  
  
//抓所有的員工上下班的打卡資料
  loadClockData() {
    this.http.get<any>('http://localhost:8080/all').subscribe({
      next: (res) => {
        const loginId = localStorage.getItem('employeeId');
        const { firstDay, lastDay } = this.currentMonthWindow();
        const first = new Date(firstDay);
        const last = new Date(lastDay);
    
        // 後端可能用 clockDateInfoResList / data / list
        const rawList = res.clockDateInfoResList ?? res.data ?? res.list ?? [];
        console.log("原始資料:", rawList);
    
        const records = rawList
          .filter((r: any) => {
            const empOk = String(r.employeeId) === loginId;
            const d = new Date(r.workDate || r.date || r.applyDate);
            return empOk && d >= first && d <= last;
          })
          .map((r: any) => {
            const workDate = r.workDate || r.date || r.applyDate;
            const clockOn  = r.clockOn || r.onTime || r.checkIn;
            const clockOff = r.clockOff || r.offTime || r.checkOut;
            const hours    = r.totalHour ?? r.workHours ?? r.hours;
    
            return {
              rawDate: workDate,
              date: new Date(workDate).toLocaleDateString('zh-TW', { weekday:'short', year:'numeric', month:'2-digit', day:'2-digit' }),
              clockOn,
              clockOff,
              totalHour: hours,
              checkIn: clockOn || '-',
              checkOut: clockOff || '-',
              hours: hours ? hours + "hr" : '-'
            };
          });
    
        this.workLogs = records;
        console.table(this.workLogs);
    
        if (records.length > 0) {
          this.calcAverages(records);
        } else {
          this.resetAverages();
        }
      }
    });
    
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

  //切換下一個月的方法
  prevMonth() {
    if (this.currentMonthIndex > 0) {
      this.currentMonthIndex--;
      this.loadClockData();   // ← 加這行
    }
  }
  //切換上一個月的方法
  nextMonth() {
    if (this.currentMonthIndex < this.months.length - 1) {
      this.currentMonthIndex++;
      this.loadClockData();   // ← 加這行
    }
  }




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


  get currentMonthName() {
    return this.months[this.currentMonthIndex];
  }



  viewMode: 'dashboard' | 'schedule' = 'dashboard';

  selectedDate: Date | null = null;
  startOfWeek: Date = this.getStartOfWeek(new Date());
  messages: Message[] = [];

  // 範例時段


  ngOnInit(): void {
    this.config = {
      scale: 'Day',
      cellWidth: 50,
      rowHeaderWidth: 150,
      resources: [],
      timeHeaders: [{ groupBy: 'Day', format: 'd' }],   // 只顯示日期號，跟朋友一致
      eventMoveHandling: 'Disabled',
      eventResizeHandling: 'Disabled',
      eventClickHandling: 'Disabled',
      onBeforeEventRender: (args) => {
        const txt = String(args.data.text ?? '');
        const first = txt.split('｜')[0]?.trim() || '休';  // 取第一段班別
        const colorMap: Record<string, string> = {
          '早': '#E3F2FD',
          '中': '#FFF8E1',
          '晚': '#E8F5E9',
          '夜': '#E1BEE7',
          '休': '#FFEBEE',
        };
        const bgColor = colorMap[first] ?? '#ECEFF1';
    
        args.data.cssClass = 'shift-event';
        args.data.html = `
          <div class="shift-box" style="background-color:${bgColor}">
            ${txt}
          </div>
        `;
      }
    } as DayPilot.SchedulerConfig;
    
    // 預設助理先打招呼
    this.messages.push({
      sender: 'assistant',
      text: '哈囉！我是您的 AI 助理  今天有什麼可以幫忙的嗎？',
    });

    this.loadClockData();
    this.loadEmployees();
    this.dayTickTimer = setInterval(() => this.ensureNewDay(), 60_000);
    this.loadWeekSlotsForCurrentWeek();
    this.loadUnreadNotifications();
  }
  loadUnreadNotifications() {
    this.http.get<any>('http://localhost:8080/notify/searchAll').subscribe({
      next: (res) => {
        const notifyList = res?.notifyList ?? [];
        const readIds = JSON.parse(localStorage.getItem('readNotices') || '[]');
  
        // 篩出還沒看過的
        const unread = notifyList.filter((n: any) => !readIds.includes(n.id));
        this.unreadCount = unread.length;
      },
      error: (err) => {
        console.error('載入通知失敗', err);
        this.unreadCount = 0;
      }
    });
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
  this.http.get<any>('http://localhost:8080/PreSchedule/getAllSchedule').subscribe({
    next: (res) => {
      const listRaw: any[] = res.preScheduleList ?? res.list ?? res.data ?? [];

      // 1) 員工清單（資源）
      const employees = new Map<string, string>();
      for (const s of listRaw) {
        const id = String(s.employeeId);
        if (!employees.has(id)) employees.set(id, s.employeeName || '');
      }
      this.config.resources = Array.from(employees).map(([id, name]) => ({ id, name }));

      // 2) 只取當月
      const { firstDay, lastDay } = this.currentMonthWindow();
      const inMonth = (d: string) => d >= firstDay && d <= lastDay;

      // 3) 依「employeeId + applyDate」彙總（含休假優先）
      type G = { empId: string; date: string; shifts: Set<string> };
      const grouped = new Map<string, G>();
      const labelOf = (id?: number) =>
        id === 0 ? '休' : ({ 1:'早', 2:'中', 3:'晚', 4:'夜' } as any)[id ?? -1] ?? '';

      for (const s of listRaw) {
        const date = String(s.applyDate ?? '').slice(0, 10);
        const empId = String(s.employeeId ?? '');
        if (!date || !empId || !inMonth(date)) continue;

        const key = `${empId}-${date}`;
        if (!grouped.has(key)) grouped.set(key, { empId, date, shifts: new Set<string>() });

        const label = labelOf(Number(s.shiftWorkId));
        if (!label) continue;

        const g = grouped.get(key)!;
        if (label === '休') { g.shifts = new Set(['休']); continue; } // 休假優先覆蓋
        if (!g.shifts.has('休')) g.shifts.add(label);
      }

      // 4) 轉事件（整天）
      const order = { '早':1, '中':2, '晚':3, '夜':4, '休':9 } as any;
      const toText = (set: Set<string>) =>
        Array.from(set).sort((a,b)=>(order[a]??99)-(order[b]??99)).join('｜');

      this.events = Array.from(grouped.values())
        .map((g, i) => ({
          id: `${g.empId}-${g.date}-${i}`,
          text: toText(g.shifts),
          start: new DayPilot.Date(`${g.date}T00:00:00`),
          end:   new DayPilot.Date(`${g.date}T23:59:59`),
          resource: g.empId     // ← 字串
        } as DayPilot.EventData))
        .filter(e => e.text !== '');

      this.scheduler?.control.update();
    },
    error: (err) => {
      console.error('載入班表失敗:', err);
      this.events = [];
      this.scheduler?.control.update();
    }
  });
}


showSchedule() {
  this.viewMode = 'schedule';

  const { firstDay, days } = this.currentMonthWindow();

  // 固定月檢視（跟朋友一致）
  this.config.scale = 'Day';
  this.config.cellWidth = 50;
  this.config.rowHeaderWidth = 150;
  this.config.timeHeaders = [{ groupBy: 'Day', format: 'd' }];

  // 鎖定當月
  this.config.startDate = new DayPilot.Date(firstDay);  // 'YYYY-MM-DD'
  this.config.days = days;

  this.loadFinalSchedule();       // 只載入當月
  this.scheduler?.control.update();
}

  
    //抓當日月份
    currentMonthIndex = new Date().getMonth();

  //取出當日月份的第一天和最後一天還有這個月總共的天數
  private currentMonthWindow() {
    const today = new Date();
    const y = today.getFullYear();           
    const m = this.currentMonthIndex;          
  
    const first = new Date(y, m, 1);       
    const last  = new Date(y, m + 1, 0);
    const days = last.getDate();
  
    return { 
      firstDay: this.formatDateLocal(first), 
      lastDay: this.formatDateLocal(last),     
      days 
    };
  }
  

  //從數字轉成字串讓後端可以接收
  private formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + "-" + m + "-" + day;
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
      width: undefined,
      height: undefined,
      maxWidth: 'none',
      maxHeight: 'none',
    });
  }



}
