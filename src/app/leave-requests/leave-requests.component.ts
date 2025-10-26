import { Component, OnInit, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

type LeaveStatus = 'approved' | 'rejected' | 'pending';

interface GetApplicationAndNameDto {
  leaveId: number;
  employeeId: string;
  name: string;
  leaveType: string;
  leaveDescription: string | null;
  leaveProve: string | null;         // 後端回傳已含 data:image/png;base64,...
  approved: boolean | null;          // true/false；待審核為 null
}

interface DetailDto {
  leaveId: number;
  employeeId: string;
  name: string;
  leaveType: string;
  leaveDescription: string | null;
  leaveProve: string | null;
  approved: boolean | null;
  leaveDate: string;                 // YYYY-MM-DD
  startTime: string;                 // HH:mm:ss
  end_time?: string;                 // 有些 API 用 end_time
  endTime?: string;                  // 有些 API 用 endTime
  leaveHours: number;
}

interface Row extends GetApplicationAndNameDto {
  status: LeaveStatus;               // 前端歸一：approved / rejected / pending
}
@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [
    CommonModule, FormsModule, HttpClientModule,
  ],

  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss',
})
export class LeaveRequestsComponent implements OnInit {
  // ===== UI 狀態 =====
  selectedMonth = signal<string>(this.initMonth());
  filterStatus   = signal<'all' | LeaveStatus>('all');
  loading        = signal<boolean>(false);
  errorMsg       = signal<string>('');
  selectedRow    = signal<Row | null>(null);
  selectedDetails= signal<DetailDto[] | null>(null);

  // ===== 資料集合 =====
  approvedRows   = signal<Row[]>([]);               // 本月（已核准/已駁回）
  pendingRows    = signal<Row[]>([]);               // 待審核（全量）
  tableApplyDateMap = signal<Record<number, string>>({}); // leaveId -> 最早 leaveDate

  // 合併後列表（依 tab 是否需含待審核）
  allRows = computed<Row[]>(() => {
    const ym = this.selectedMonth();
  
    // 已核准/已駁回：後端已依月份篩過，直接用
    const list: Row[] = [...this.approvedRows()];
  
    // 待審核：只納入「屬於當月」的
    if (this.filterStatus() === 'all' || this.filterStatus() === 'pending') {
      const monthPending = this.pendingRows().filter(r =>
        this.inMonthByEarliestDate(r.leaveId, ym)
      );
      list.push(...monthPending);
    }
    return list;
  });
  
  filteredRows = computed(() => {
    const st = this.filterStatus();            // 'all' | 'pending' | 'approved' | 'rejected'
    return this.allRows()
      .filter(r => (st === 'all' ? true : r.status === st))
      .sort((a, b) => b.leaveId - a.leaveId);
  });

  /** KPI：列表（目前畫面筆數）/ 待審核（全量）/ 本月的已核准與已駁回 */
  kpi = computed(() => {
    const list = this.filteredRows().length;
    const ym = this.selectedMonth();
const pending = this.pendingRows().filter(r => this.inMonthByEarliestDate(r.leaveId, ym)).length;

    const approved = this.approvedRows().filter(r => r.status === 'approved').length;
    const rejected = this.approvedRows().filter(r => r.status === 'rejected').length;
    return { list, pending, approved, rejected };
  });

  // 後端位址
  private API_BASE = 'http://localhost:8080';

  constructor(private http: HttpClient, private route: ActivatedRoute) {
    // 月份變動 → 重新抓「本月已核准/已駁回」並預抓每筆最早日期
    effect(() => { void this.fetchApprovedForMonth(this.selectedMonth()); });
  }

  ngOnInit(): void {
    // 讀取 query（從表單頁帶過來）
    const qp = this.route.snapshot.queryParamMap;
 
    const st = qp.get('status') as 'pending' | 'approved' | 'rejected' | null;

    if (st && ['pending', 'approved', 'rejected'].includes(st)) {
      this.filterStatus.set(st);
    }

    // 待審核（全量，一次抓）
    void this.fetchPendingOnce();
  }

  // ===== API =====
  private async fetchApprovedForMonth(ym: string): Promise<void> {
    const { start, end } = this.monthRange(ym);
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const url = `${this.API_BASE}/leave/getApprovedLeave?start=${start}&end=${end}`;
      const list = await firstValueFrom(this.http.get<GetApplicationAndNameDto[]>(url));

      const rows: Row[] = (list || []).map(x => ({
        ...x,
        status: x.approved === true ? 'approved' : 'rejected',
      }));
      this.approvedRows.set(rows);

      // 預抓表格要顯示的「最早申請日期」
      await this.prefetchEarliestDates(rows);
    } catch (e: any) {
      this.errorMsg.set(e?.message || '載入失敗');
      this.approvedRows.set([]);
      this.tableApplyDateMap.set({});
    } finally {
      this.loading.set(false);
    }
  }

  private async fetchPendingOnce(): Promise<void> {
    try {
      const url = `${this.API_BASE}/leave/getAllApplication`;
      const list = await firstValueFrom(this.http.get<GetApplicationAndNameDto[]>(url));
      const rows: Row[] = (list || []).map(x => ({ ...x, status: 'pending' }));
      this.pendingRows.set(rows);

      // 也預抓待審核的「最早申請日期」
      await this.prefetchEarliestDates(rows);
    } catch {
      this.pendingRows.set([]);
    }
  }

  /** 抓每個 leaveId 的最早 leaveDate（表格「申請日期」欄位用） */
  private async prefetchEarliestDates(rows: Row[]): Promise<void> {
    const ids = Array.from(new Set(rows.map(r => r.leaveId)));
    await Promise.all(
      ids.map(async id => {
        if (this.tableApplyDateMap()[id]) return; // 有快取就跳過
        try {
          const url = `${this.API_BASE}/leave/getLeaveByLeaveId?leaveId=${id}`;
          const details = await firstValueFrom(this.http.get<DetailDto[]>(url));
          if (details?.length) {
            const date = details.map(d => d.leaveDate).sort()[0];
            this.tableApplyDateMap.update(m => ({ ...m, [id]: date }));
          }
        } catch {
          // 單筆失敗忽略即可
        }
      })
    );
  }

  // ===== 詳情彈窗 =====
  async openDetails(r: Row) {
    this.selectedRow.set(r);
    this.selectedDetails.set(null);
    try {
      const url = `${this.API_BASE}/leave/getLeaveByLeaveId?leaveId=${r.leaveId}`;
      const list = await firstValueFrom(this.http.get<DetailDto[]>(url));
      this.selectedDetails.set(list || []);
    } catch {
      this.selectedDetails.set([]);
    }
  }
  closeDetails() { this.selectedRow.set(null); }

  // ===== 互動 =====
  changeMonth(offset: number) {
    const [y, m] = this.selectedMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    this.selectedMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // ===== 顯示工具 =====
  statusLabel(s: LeaveStatus) {
    return s === 'approved' ? '已核准' : s === 'rejected' ? '已駁回' : '待審核';
  }
  statusClass(s: LeaveStatus) {
    return s === 'approved' ? 'chip chip--green'
         : s === 'rejected' ? 'chip chip--red'
         : 'chip chip--yellow';
  }
  typeClass(type: string) {
    switch (type) {
      case '事假': return 'pill pill--blue';
      case '病假': return 'pill pill--purple';
      case '特休': return 'pill pill--emerald';
      case '婚假': return 'pill pill--pink';
      case '喪假': return 'pill pill--gray';
      default:     return 'pill';
    }
  }
  monthDisplay(): string {
    const [y, m] = this.selectedMonth().split('-');
    return `${y}年 ${m}月`;
  }
  trackById = (_: number, r: Row) => r.leaveId;

  tableApplyDate(id: number): string {
    return this.tableApplyDateMap()[id] || '-';
  }

  periodText(details: DetailDto[] | null): string {
    if (!details || !details.length) return '-';
    const dates = Array.from(new Set(details.map(d => d.leaveDate))).sort();
    const start = dates[0];
    const end   = dates[dates.length - 1];
    const days  = dates.length; // 以不同日期數量計算（若需要精確天數可改為日期差）
    return `${start} 至 ${end}（${days} 天）`;
  }
/** 判斷 leaveId 的最早日期是否落在選定月份 */
private inMonthByEarliestDate(leaveId: number, ym: string): boolean {
  const d = this.tableApplyDateMap()[leaveId]; // e.g. '2025-10-16'
  if (!d) return false; // 日期未快取時先不顯示，等 prefetch 完會自動重算
  const { start, end } = this.monthRange(ym);
  return d >= start && d <= end;
}

  // ===== 日期工具 =====
  private monthRange(ym: string) {
    const [y, m] = ym.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(start), end: fmt(end) };
  }
  private initMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
