import { Component, OnInit, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  leaveDate: string;
  startTime: string;
  end_time?: string;
  endTime?: string;
  leaveHours: number;
}

interface Row extends GetApplicationAndNameDto {
  status: LeaveStatus;
}

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
  templateUrl: './leave-requests.component.html',
  styleUrl: './leave-requests.component.scss',
})
export class LeaveRequestsComponent implements OnInit {
  // ===== UI 狀態 =====
  selectedMonth   = signal<string>(this.initMonth());
  filterStatus    = signal<'all' | LeaveStatus>('all');
  loading         = signal<boolean>(false);
  errorMsg        = signal<string>('');
  selectedRow     = signal<Row | null>(null);
  selectedDetails = signal<DetailDto[] | null>(null);

  // ===== 資料集合 =====
  approvedRows        = signal<Row[]>([]);
  pendingRows         = signal<Row[]>([]);
  tableApplyDateMap   = signal<Record<number, string>>({});
  tablePeriodMap      = signal<Record<number, string>>({});

  // 合併後列表（依 tab 是否需含待審核）
  allRows = computed<Row[]>(() => {
    const ym = this.selectedMonth();
    const list: Row[] = [...this.approvedRows()];
    if (this.filterStatus() === 'all' || this.filterStatus() === 'pending') {
      const monthPending = this.pendingRows().filter(r =>
        this.inMonthByEarliestDate(r.leaveId, ym)
      );
      list.push(...monthPending);
    }
    return list;
  });

  filteredRows = computed(() => {
    const st = this.filterStatus();
    return this.allRows()
      .filter(r => (st === 'all' ? true : r.status === st))
      .sort((a, b) => b.leaveId - a.leaveId);
  });

  kpi = computed(() => {
    const list = this.filteredRows().length;
    const ym = this.selectedMonth();
    const pending  = this.pendingRows().filter(r => this.inMonthByEarliestDate(r.leaveId, ym)).length;
    const approved = this.approvedRows().filter(r => r.status === 'approved').length;
    const rejected = this.approvedRows().filter(r => r.status === 'rejected').length;
    return { list, pending, approved, rejected };
  });

  // 後端位址
  private API_BASE = 'http://localhost:8080';

  constructor(private http: HttpClient, private route: ActivatedRoute) {
    effect(() => { void this.fetchApprovedForMonth(this.selectedMonth()); });
  }

  ngOnInit(): void {
    // 沒拿到 employeeId 直接提示
    if (!this.myId()) {
      this.errorMsg.set('找不到登入資訊（employeeId），請重新登入。');
      return;
    }

    const qp = this.route.snapshot.queryParamMap;
    const st = qp.get('status') as 'pending' | 'approved' | 'rejected' | null;
    if (st && ['pending', 'approved', 'rejected'].includes(st)) {
      this.filterStatus.set(st);
    }

    void this.fetchPendingOnce();
  }

  /** 從 localStorage 取得登入者 employeeId（支援字串或 JSON 結構） */
  private myId(): string {
    const raw = localStorage.getItem('employeeId');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      return String(parsed?.employeeId ?? '');
    } catch {
      return raw;
    }
  }

  private async fetchApprovedForMonth(ym: string): Promise<void> {
    if (!this.myId()) return;
    const { start, end } = this.monthRange(ym);
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const url = `${this.API_BASE}/leave/getApprovedLeave?start=${start}&end=${end}`;
      const list = await firstValueFrom(this.http.get<GetApplicationAndNameDto[]>(url));
  
      // 只顯示我的
      const mine = (list || []).filter(x => x.employeeId === this.myId());
  

      const uniqByLeaveId = Array.from(
        new Map(mine.map(x => [x.leaveId, x])).values()
      );
  
      const rows: Row[] = uniqByLeaveId.map(x => ({
        ...x,
        status: x.approved === true ? 'approved' : 'rejected',
      }));
      this.approvedRows.set(rows);
  
      await this.prefetchMetaForRows(rows);
    } catch (e: any) {
      this.errorMsg.set(e?.message || '載入失敗');
      this.approvedRows.set([]);
      this.tableApplyDateMap.set({});
      this.tablePeriodMap.set({});
    } finally {
      this.loading.set(false);
    }
  }
  

  private async fetchPendingOnce(): Promise<void> {
    if (!this.myId()) return;
    try {
      const url = `${this.API_BASE}/leave/getAllApplication`;
      const list = await firstValueFrom(this.http.get<GetApplicationAndNameDto[]>(url));

      // 只顯示我的
      const mine = (list || []).filter(x => x.employeeId === this.myId());

      const rows: Row[] = mine.map(x => ({ ...x, status: 'pending' }));
      this.pendingRows.set(rows);

      await this.prefetchMetaForRows(rows);
    } catch {
      this.pendingRows.set([]);
    }
  }

  private async prefetchMetaForRows(rows: Row[]): Promise<void> {
    const ids = Array.from(new Set(rows.map(r => r.leaveId)));
    await Promise.all(
      ids.map(async (id) => {
        const hasDate   = !!this.tableApplyDateMap()[id];
        const hasPeriod = !!this.tablePeriodMap()[id];
        if (hasDate && hasPeriod) return;

        try {
          const url = `${this.API_BASE}/leave/getLeaveByLeaveId?leaveId=${id}`;
          const details = await firstValueFrom(this.http.get<DetailDto[]>(url));

          if (details?.length) {
            const earliest = details.map(d => d.leaveDate).sort()[0];
            this.tableApplyDateMap.update(m => ({ ...m, [id]: earliest }));
            const period = this.formatPeriod(details);
            this.tablePeriodMap.update(m => ({ ...m, [id]: period }));
          }
        } catch {
          // 單筆失敗忽略
        }
      })
    );
  }

  async openDetails(r: Row) {
    // 防呆：不是自己的單不開
    if (r.employeeId !== this.myId()) return;

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

  changeMonth(offset: number) {
    const [y, m] = this.selectedMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    this.selectedMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

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
      case '其他': return 'pill pill--slate';       
      default:     return 'pill pill--slate';  
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

  tablePeriod(r: Row): string {
    return this.tablePeriodMap()[r.leaveId] || '-';
  }

  periodText(details: DetailDto[] | null): string {
    if (!details || !details.length) return '-';
    const dates = Array.from(new Set(details.map(d => d.leaveDate))).sort();
    const start = dates[0];
    const end   = dates[dates.length - 1];
    const days  = dates.length;
    return `${start} 至 ${end}（${days} 天）`;
  }

  private inMonthByEarliestDate(leaveId: number, ym: string): boolean {
    const d = this.tableApplyDateMap()[leaveId]; // e.g. '2025-10-16'
    if (!d) return false;
    const { start, end } = this.monthRange(ym);
    return d >= start && d <= end;
  }

  private formatPeriod(list: DetailDto[]): string {
    if (!list?.length) return '-';
    const byDate: Record<string, DetailDto[]> = {};
    for (const it of list) {
      (byDate[it.leaveDate] ??= []).push(it);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const days = Object.keys(byDate).sort();
    const out: string[] = [];
    for (const day of days) {
      const segs = byDate[day]
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        .map(it => {
          const s = (it.startTime || '').slice(0, 5);
          let e = (it.endTime ?? it.end_time ?? '').slice(0, 5);
          if (!e && s && it.leaveHours) {
            const [sh, sm] = s.split(':').map(Number);
            const start = new Date(`${day}T${pad(sh)}:${pad(sm)}:00`);
            start.setMinutes(start.getMinutes() + Math.round(it.leaveHours * 60));
            e = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
          }
          return (s && e) ? `${s} ~ ${e}` : s ? s : '-';
        });
      out.push(`${day.replaceAll('-', '/')} ${segs.join('；')}`);
    }
    return out.join('\n');
  }

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
