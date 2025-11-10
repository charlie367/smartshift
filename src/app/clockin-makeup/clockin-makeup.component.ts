import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';

/* ===== 型別 ===== */
interface ApiRes<T> { data: T; message?: string; code?: number; success?: boolean; }
interface ClockDate {
  employeeId: string;
  workDate: string;
  clockOn?: string|null;
  clockOff?: string|null;
  restStart?: string|null;
  restEnd?: string|null;
  shiftWorkId?: number|null;
}
interface ExtraShiftSE { startTime: string; endTime: string; _orig?: number; }

export interface ClockinMakeupForm {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  lunchStartTime?: string;
  lunchEndTime?: string;
  rating: number;
  description: string;
  file: File | null;
  extraShifts?: ExtraShiftSE[];
}

@Component({
  selector: 'app-clockin-makeup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './clockin-makeup.component.html',
  styleUrls: ['./clockin-makeup.component.scss'],
})
export class ClockinMakeupComponent implements OnInit {

  /* ===== 狀態 ===== */
  limitToToday = true;
  form: ClockinMakeupForm = {
    employeeId: '', date: '',
    startTime: '', endTime: '',
    lunchStartTime: '', lunchEndTime: '',
    rating: 0, description: '',
    file: null, extraShifts: [],
  };

  errors: Partial<Record<keyof ClockinMakeupForm, string>> = {};
  fileName = ''; previewUrl = '';
  loading = false; showErrors = false; dragOver = false;
  today = new Date().toISOString().slice(0,10);
  stars = [1,2,3,4,5] as const;

  private readonly API_BASE = 'http://localhost:8080';
  private prefillToken = 0;
  private lastSubmittedKey = '';

  // 是否休假（沒有班表）
  private isRestDay = false;

  // 主段是否由其他段頂上來（顯示「第 X 組」）
  promotedFromIndex: number | null = null;

  // 班別定義（可調）
  private readonly SHIFT_TABLE: Record<number, {start:string; end:string}> = {
    1: { start: '08:00', end: '12:00' },
    2: { start: '12:00', end: '16:00' },
    3: { start: '16:00', end: '20:00' },
    4: { start: '20:00', end: '00:00' },
  };

  constructor(
    private dialogRef: MatDialogRef<ClockinMakeupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<ClockinMakeupForm>,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
  ){
    this.form.employeeId = (data.employeeId || '').toUpperCase();
    this.form.date = data.date || '';
  }

  ngOnInit(): void {
    if (this.form.employeeId && this.form.date) {
      void this.prefillOnlyMissing(this.form.employeeId, this.form.date, { override: true });
    }
  }

  /* ===== 工具 ===== */
  private normDate(s?: string|null){ return s ? String(s).split('T')[0].replace(/[/.]/g,'-') : ''; }
  private normEmp(s: string){ return (s||'').trim().toUpperCase(); }
  private normTime(s?: string|null){
    if (!s) return '';
    const [h='0', m='0'] = String(s).trim().split(':');
    return `${h.padStart(2,'0')}:${(m ?? '00').padStart(2,'0').slice(0,2)}`;
  }

  private minToHHMM(min: number){
    min = ((min % (24*60)) + (24*60)) % (24*60);
    const h = Math.floor(min/60), m = min%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  /** 驗證比較用：把 "00:00" 視為 24:00 */
  private toMinForValidation(t?: string): number {
    if (!t) return NaN;
    return t === '00:00' ? 24*60 : this.toMin(t);
  }

  /** 把 '12:00' 依情境矯正成 午夜(00:00) 或 中午(12:00) */
  private normalizeNoonMidnight(start?: string, end?: string): string | undefined {
    if (!end || end !== '12:00') return end;
    if (!start) return end;
    const s = this.toMin(start);
    if (!Number.isFinite(s)) return end;
    // 晚上 >= 18:00 開始到「12:00」→ 視為跨日至 00:00
    return s >= 18 * 60 ? '00:00' : '12:00';
  }

  private inferEndFromStart(start?: string): string {
    const s = this.toMin(this.normTime(start)); if (!Number.isFinite(s)) return '';
    for (const id of Object.keys(this.SHIFT_TABLE)){
      const seg = this.SHIFT_TABLE[+id];
      let a = this.toMin(seg.start), b = this.toMin(seg.end);
      if (b < a) b += 24*60;
      if (s >= a && s < b) return this.normTime(seg.end);
    }
    return '';
  }

  /* ===== 午休規則 ===== */
  private autoLunchByMidpoint(start: string, end: string){
    if (this.form.lunchStartTime || this.form.lunchEndTime) return;
    const s = this.toMin(start); let e = this.toMin(end);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return;
    if (e <= s) e += 24*60;
    const mid = Math.floor((s + e) / 2);
    this.form.lunchStartTime = this.minToHHMM(mid - 30);
    this.form.lunchEndTime   = this.minToHHMM(mid + 30);
  }
  private applyAutoLunchAfterMerge(merged: Array<{ startTime: string; endTime: string }>, hadAdjacent: boolean) {
    this.form.lunchStartTime = '';
    this.form.lunchEndTime   = '';
    if (!hadAdjacent) return;
    if (!merged.length) return;
    const main = merged[0];
    if (main.startTime && main.endTime) this.autoLunchByMidpoint(main.startTime, main.endTime);
  }

  /* ===== 事件 ===== */
  touch(_field: keyof ClockinMakeupForm){ this.validate(); this.showErrors = true; }

  onStartTimeChange(val: string){
    this.promotedFromIndex = null;
    this.form.startTime = this.normTime(val);
    if (!this.form.endTime){
      const infer = this.inferEndFromStart(this.form.startTime);
      if (infer) this.form.endTime = infer;
    }
    this.validate();
  }

  onEndTimeChange(val: string){
    this.promotedFromIndex = null;
    const v = this.normTime(val);
    this.form.endTime = this.normalizeNoonMidnight(this.form.startTime, v) || v;
    this.validate();
  }

  onExtraStartChange(i: number, val: string){
    const seg = (this.form.extraShifts ?? [])[i]; if (!seg) return;
    seg.startTime = this.normTime(val);
    if (!seg.endTime){
      const infer = this.inferEndFromStart(seg.startTime);
      if (infer) seg.endTime = infer;
    }
    this.validate();
  }

  onExtraEndChange(i: number, val: string){
    const seg = (this.form.extraShifts ?? [])[i]; if (!seg) return;
    const v = this.normTime(val);
    seg.endTime = this.normalizeNoonMidnight(seg.startTime, v) || v;
    this.validate();
  }

  onLunchStartChange(val: string){
    this.form.lunchStartTime = this.normTime(val);
    if (this.form.lunchStartTime && !this.form.lunchEndTime){
      const s = this.toMin(this.form.lunchStartTime);
      this.form.lunchEndTime = this.minToHHMM(s + 60);
    }
    this.validate();
  }

  /** 點主段的 ✕：用下一組頂上來，並標註「第 X 組」 */
  removeMainShift(){
    if (this.form.extraShifts && this.form.extraShifts.length){
      const next = this.form.extraShifts.shift()!;
      this.form.startTime = next.startTime || '';
      this.form.endTime   = next.endTime   || '';
      this.promotedFromIndex = next._orig ?? 2; // 顯示（第 X 組）
    } else {
      this.form.startTime = '';
      this.form.endTime = '';
      this.promotedFromIndex = null;
    }
    this.errors.startTime = undefined; this.errors.endTime = undefined;
    this.validate();
  }
  removeShift(i: number){
    (this.form.extraShifts ??= []).splice(i,1);
    this.validate();
  }

  /* ===== 預填 ===== */
  private async fetchScheduleSegments(emp: string, ymd: string){
    type ShiftDetail = { shiftWorkId:number; accept:boolean; startTime:any; endTime:any; };
    type Res = { shiftDetailList: ShiftDetail[] };
    const r = await this.tryGet<Res>(`${this.API_BASE}/PreSchedule/selectScheduleByIdAndDate`,
      { employeeId: emp, date: ymd });
    const list = r?.shiftDetailList ?? [];
    return list
      .filter(x => x.accept && x.shiftWorkId !== 0)
      .map(x => {
        const s = typeof x.startTime === 'string'
          ? x.startTime.slice(0,5)
          : `${String(x.startTime?.hour ?? 0).padStart(2,'0')}:${String(x.startTime?.minute ?? 0).padStart(2,'0')}`;
        const e = typeof x.endTime === 'string'
          ? x.endTime.slice(0,5)
          : `${String(x.endTime?.hour ?? 0).padStart(2,'0')}:${String(x.endTime?.minute ?? 0).padStart(2,'0')}`;
        return { start: this.normTime(s), end: this.normTime(e) };
      })
      .sort((a,b)=> this.toMin(a.start) - this.toMin(b.start));
  }

  private buildPunchSegmentsAllowSingle(rows: ClockDate[], schedule: Array<{start:string; end:string}>): ExtraShiftSE[] {
    const inSpan = (t: string, seg: {start:string; end:string}) => {
      const x = this.toMin(t), s = this.toMin(seg.start); let e = this.toMin(seg.end);
      if (e <= s) e += 24*60; let xx = x; if (xx < s) xx += 24*60;
      return xx >= s && xx <= e;
    };

    const segs: ExtraShiftSE[] = [];
    for (const r of rows) {
      const on  = this.normTime(r.clockOn);
      const off = this.normTime(r.clockOff);

      if (on && off) { segs.push({ startTime: on, endTime: off }); continue; }

      if (on && !off) {
        const host = schedule.find(seg => inSpan(on, seg));
        const end  = host ? host.end : this.inferEndFromStart(on);
        segs.push({ startTime: on, endTime: end || '' });
        continue;
      }

      if (!on && off) {
        const host = schedule.find(seg => inSpan(off, seg));
        const start = host ? host.start : '';
        if (start) segs.push({ startTime: start, endTime: off });
      }
    }
    return segs
      .filter(s => !!s.startTime)
      .sort((a,b)=> this.toMin(a.startTime) - this.toMin(b.startTime));
  }

  private mergeByOverlap(schedule: Array<{start:string; end:string}>, punches: ExtraShiftSE[]): ExtraShiftSE[] {
    const schMerged: Array<{start:string; end:string}> = [];
    for (const seg of schedule) {
      const last = schMerged[schMerged.length - 1];
      if (last && last.end === seg.start) last.end = seg.end;
      else schMerged.push({ ...seg });
    }

    const used = new Set<number>(); const out: ExtraShiftSE[] = [];
    for (const sch of schMerged){
      const s1 = this.toMin(sch.start); const e1 = this.toMin(sch.end);
      let pick = -1, bestOL = 0;
      punches.forEach((p, i) => {
        if (used.has(i)) return;
        const s2 = this.toMin(p.startTime), e2 = this.toMin(p.endTime || '');
        const ee = Number.isFinite(e2) ? e2 : s2;
        const ol = Math.max(0, Math.min(e1, ee) - Math.max(s1, s2));
        if (ol > bestOL) { bestOL = ol; pick = i; }
      });

      if (pick >= 0 && bestOL >= 1) {
        used.add(pick);
        const p = punches[pick];
        out.push({ startTime: p.startTime, endTime: p.endTime || sch.end });
      } else {
        out.push({ startTime: sch.start, endTime: sch.end });
      }
    }
    return out;
  }

  private async prefillOnlyMissing(employeeId: string, ymd: string, opt: { override?: boolean } = {}){
    const emp = this.normEmp(employeeId); const dateKey = this.normDate(ymd);
    if (!emp || !dateKey) return;
    this.loading = true; const token = ++this.prefillToken;

    // 1) 班表
    const schedule = await this.fetchScheduleSegments(emp, dateKey);
    if (token !== this.prefillToken) return;

    // 休假判斷
    this.isRestDay = schedule.length === 0;

    if (this.isRestDay) {
      if (opt.override) this.clearTimes();
      this.loading = false; this.cdr.detectChanges(); return;
    }

    const hasAdjacent = schedule.some((seg, i) => i > 0 && schedule[i-1].end === seg.start);

    // 2) 打卡 rows
    const r = await this.tryGet<ApiRes<ClockDate[]>>(`${this.API_BASE}/single/date`, { employeeId: emp, workDate: dateKey });
    if (token !== this.prefillToken) return;
    const rows = r?.data ?? [];

    // 3) rows → 打卡段（允許單邊）→ 覆蓋班表
    const punches = this.buildPunchSegmentsAllowSingle(rows, schedule);
    const merged = this.mergeByOverlap(schedule, punches);

    // 4) 寫回表單（把原始序號寫進 _orig：第二段從 2 開始）
    this.form.startTime  = merged[0]?.startTime ?? '';
    this.form.endTime    = merged[0]?.endTime   ?? '';
    this.form.extraShifts = merged.slice(1).map((s, i) => ({ ...s, _orig: i + 2 }));
    this.promotedFromIndex = null;

    // 5) 只有「相接班」才帶午休（主段正中間 1hr）
    this.applyAutoLunchAfterMerge(merged, hasAdjacent);

    this.validate(); this.loading = false; this.cdr.detectChanges();
  }

  /* ===== 其它：I/O、驗證、送出 ===== */

  onEmpChange(v: string|null){
    this.form.employeeId = (v ?? '').trim().toUpperCase();
    this.isRestDay = false;     // 等待查班表再決定
    this.clearTimes();
    if (this.form.employeeId && this.form.date) void this.prefillOnlyMissing(this.form.employeeId, this.form.date);
  }
  onDateChange(v: string|null){
    this.form.date = (v ?? '').trim();
    this.isRestDay = false;
    this.clearTimes();
    if (this.form.employeeId && this.form.date) void this.prefillOnlyMissing(this.form.employeeId, this.form.date);
  }

  private clearTimes(){
    this.form.startTime = ''; this.form.endTime = '';
    this.form.lunchStartTime = ''; this.form.lunchEndTime = '';
    this.form.extraShifts = [];
    this.promotedFromIndex = null;
    this.errors = {};
  }

  private async tryGet<T>(url: string, params?: Record<string,string>): Promise<T | null> {
    try {
      const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
      return await firstValueFrom(this.http.get<T>(url, { params: httpParams }));
    } catch { return null; }
  }

  // ---- 檔案 ----
  onDragOver(e: DragEvent){ e.preventDefault(); this.dragOver = true; }
  onDragLeave(e: DragEvent){ e.preventDefault(); this.dragOver = false; }
  onDrop(e: DragEvent){ e.preventDefault(); this.dragOver = false;
    const f = e.dataTransfer?.files?.[0]; if (f) this.setFile(f); }
  onFileChange(e: Event){ const f = (e.target as HTMLInputElement).files?.[0]; if (f) this.setFile(f); }
  removeFile(ev?: Event){ ev?.stopPropagation(); this.form.file = null; this.fileName=''; this.previewUrl=''; this.errors.file = undefined; }

  private readonly MAX_SIZE = 10*1024*1024;
  private readonly ALLOW_EXTS = ['pdf','doc','docx']; // 其他交給 MIME
  private readonly ALLOW_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  private setFile(file: File){
    const isImage = file.type.startsWith('image/');  // 接受所有 image/*
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const ok = isImage || this.ALLOW_EXTS.includes(ext) || this.ALLOW_TYPES.includes(file.type);
    if (!ok){ this.errors.file='不支援的檔案格式'; this.showErrors = true; return; }
    if (file.size > this.MAX_SIZE){ this.errors.file='檔案超過 10MB 上限'; this.showErrors = true; return; }
    this.form.file = file; this.fileName = file.name; this.errors.file = undefined;
    if (file.type.startsWith('image/') || ['jpg','jpeg','png'].includes(ext)){
      const reader = new FileReader(); reader.onloadend = () => this.previewUrl = String(reader.result || '');
      reader.readAsDataURL(file);
    } else { this.previewUrl = ''; }
  }

  reset(){
    this.form = { ...this.form, startTime:'', endTime:'', lunchStartTime:'', lunchEndTime:'', rating:0, description:'', file:null, extraShifts:[] };
    this.fileName=''; this.previewUrl=''; this.errors={}; this.showErrors=false;
    this.promotedFromIndex = null;
  }

  private validate(): boolean {
    const e: typeof this.errors = {};
  
    // 基本欄位
    if (!this.form.employeeId?.trim()) e.employeeId = '員工編號為必填';
    else if (!/^[A-Za-z0-9-]{3,20}$/.test(this.form.employeeId.trim())) e.employeeId = '格式不正確（英數/連字號 3~20 字）';
  
    if (!this.form.date) e.date = '日期為必填';
    else if (this.form.date > this.today) e.date = '日期不可晚於今天';
  
    // 上下班：休假或兩個都空 → 不必填；有填一邊就檢查另一邊；時間需遞增
    const hasStart = !!this.form.startTime;
    const hasEnd   = !!this.form.endTime;
  
    if (!this.isRestDay) {
      if (hasStart && !hasEnd) e.endTime   = '結束時間為必填';
      if (!hasStart && hasEnd) e.startTime = '開始時間為必填';
  
      if (hasStart && hasEnd) {
        const s  = this.toMinForValidation(this.form.startTime);
        const ed = this.toMinForValidation(this.form.endTime);
        if (Number.isFinite(s) && Number.isFinite(ed) && ed <= s) {
          e.endTime = '下班打卡時間需晚於上班打卡時間';
        }
      }
    }
  
    // 其它段：只在「填一半」或「時間顛倒」時提示
    (this.form.extraShifts ?? []).forEach((seg, idx) => {
      const a = !!seg.startTime, b = !!seg.endTime;
      if (a && !b) e.endTime   ||= `第 ${idx+2} 組：結束時間為必填`;
      if (!a && b) e.startTime ||= `第 ${idx+2} 組：開始時間為必填`;
      if (a && b) {
        const ss = this.toMinForValidation(seg.startTime);
        const ee = this.toMinForValidation(seg.endTime);
        if (Number.isFinite(ss) && Number.isFinite(ee) && ee <= ss) {
          e.endTime ||= `第 ${idx+2} 組：結束需晚於開始`;
        }
      }
    });
  
    const hasLunchS = !!this.form.lunchStartTime;
    const hasLunchE = !!this.form.lunchEndTime;
    if (hasLunchS && !hasLunchE) e.lunchEndTime   = '午休結束為必填';
    if (!hasLunchS && hasLunchE) e.lunchStartTime = '午休開始為必填';
    if (hasLunchS && hasLunchE) {
      const ls = this.toMinForValidation(this.form.lunchStartTime);
      const le = this.toMinForValidation(this.form.lunchEndTime);
      if (Number.isFinite(ls) && Number.isFinite(le) && le <= ls) {
        e.lunchEndTime = '午休結束需晚於午休開始';
      }
    }
  
    // 評分必填（至少 1 顆）
    if (!Number.isFinite(this.form.rating) || this.form.rating < 1) {
      e.rating = '請選擇重要程度評分';
    }
  
    // 原因說明必填
    if (!this.form.description?.trim()) e.description = '請填寫補打卡原因說明';
  
    this.errors = e;
    return Object.keys(e).length === 0;
  }
  
  addEmptyShift(): void {
    if ((this.form.extraShifts?.length ?? 0) >= 1) return;
    (this.form.extraShifts ??= []).push({
      startTime: '',
      endTime: '',
      _orig: (this.form.extraShifts?.length ?? 0) + 2,
    });
    this.promotedFromIndex = null;
    this.validate();
  }

  setRating(n: number){
    this.form.rating = n;
    this.validate();
  }
  
  /** 將 "HH:mm" 轉成 "HH:mm:ss" */
  private asHHMMSS(t?: string): string|null {
    if (!t) return null;
    const [h='00', m='00'] = String(t).split(':');
    return `${h.padStart(2,'0')}:${m.padStart(2,'0')}:00`;
  }

  /** 檔案轉 base64（字串）；不是圖片也能轉 */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async submit() {
    this.showErrors = true;
    if (!this.validate()) return;

    // 1) 蒐集所有時間段（主段 + 其它段）並矯正 12:00
    const rawSegments = [
      { start: this.form.startTime, end: this.form.endTime },
      ...(this.form.extraShifts ?? []).map(s => ({ start: s.startTime, end: s.endTime })),
    ];

    const segments = rawSegments
      .map(seg => ({
        start: seg.start,
        end: this.normalizeNoonMidnight(seg.start, seg.end) || seg.end,
      }))
      .filter(seg => !!seg.start && !!seg.end);

    if (!segments.length) {
      this.errors.endTime = '請至少填寫一組完整的上/下班時間';
      this.dialog.open(ErrorDialogComponent, {
        width: '360px',
        panelClass: 'error-dialog-panel',
        data: { message: this.errors.endTime, autoCloseMs: 2000 },
      });
      return;
    }

    // 2) 檔案轉 base64（可選）
    let proveBase64: string | null = null;
    if (this.form.file) {
      try {
        proveBase64 = await this.fileToBase64(this.form.file);
      } catch {
        proveBase64 = null;
      }
    }

    // 3) 依「是否連續」分組
    const lunchStart = this.form.lunchStartTime || undefined;
    const lunchEnd   = this.form.lunchEndTime   || undefined;
    const GAP_TOLERANCE_MIN = 0;

    const isLunchGap = (prevEnd: string, nextStart: string) =>
      !!lunchStart && !!lunchEnd &&
      this.toMin(prevEnd) === this.toMin(lunchStart) &&
      this.toMin(nextStart) === this.toMin(lunchEnd);

    const groups = [...segments]
      .sort((a, b) => this.toMin(a.start)! - this.toMin(b.start)!)
      .reduce((acc: { start: string; end: string }[][], cur) => {
        const lastGroup = acc[acc.length - 1];
        if (!lastGroup || !lastGroup.length) {
          acc.push([cur]);
        } else {
          const prev = lastGroup[lastGroup.length - 1];
          const gap = this.toMin(cur.start)! - this.toMin(prev.end)!;
          const contiguous = gap >= 0 && (gap <= GAP_TOLERANCE_MIN || isLunchGap(prev.end, cur.start));
          contiguous ? lastGroup.push(cur) : acc.push([cur]);
        }
        return acc;
      }, []);

    // 4) 每一組輸出「一筆」DTO
    const payload = groups.map((g, gi) => ({
      employeeId : this.form.employeeId.trim(),
      workDate   : this.form.date,
      clockOn    : this.asHHMMSS(g[0].start),
      clockOff   : this.asHHMMSS(g[g.length - 1].end),
      restStart  : gi === 0 ? this.asHHMMSS(lunchStart) : null,
      restEnd    : gi === 0 ? this.asHHMMSS(lunchEnd)   : null,
      score      : this.form.rating,
      description: (this.form.description || '').trim(),
      prove      : proveBase64,
    }));

    // 5) 去重（全部成功後才記 key）
    const key = JSON.stringify(payload);
    if (key === this.lastSubmittedKey) return;

    this.loading = true;
    try {
      // 6) 後端規則：一班一筆 -> 逐筆送出
      for (const dto of payload) {
        const res = await firstValueFrom(
          this.http.post<{ code: number; message: string }>(
            `${this.API_BASE}/clock/missClockApply`,
            [dto] // 若後端改成吃單筆 DTO，將 [dto] 改成 dto
          )
        );
        if (res?.code !== 200) throw new Error(res?.message || '送出失敗，請稍後再試');
      }

      this.lastSubmittedKey = key;

      const sref = this.dialog.open(SuccessDialogComponent, {
        width: '360px',
        panelClass: 'success-dialog-panel',
        disableClose: true,
      });
      sref.afterClosed().subscribe(() => {
        this.dialogRef.close({ ok: true, message: '補打卡申請已送出！' });
      });

    } catch (err: any) {
      this.lastSubmittedKey = '';
      this.dialog.open(ErrorDialogComponent, {
        width: '360px',
        panelClass: 'error-dialog-panel',
        data: { message: err?.message || '連線失敗或伺服器錯誤，請稍後再試', autoCloseMs: 2200 },
      });
    } finally {
      this.loading = false;
    }
  }

  private toMin(t?: string){
    if (!t) return NaN;
    const [h,m] = t.split(':'); const hh = +h, mm = +m;
    return Number.isFinite(hh)&&Number.isFinite(mm) ? hh*60+mm : NaN;
  }

  private groupByContiguity(
    segs: { start: string; end: string }[],
    lunchStart?: string,
    lunchEnd?: string,
    gapToleranceMin = 0
  ){
    const isLunchGap = (prevEnd: string, nextStart: string) =>
      !!lunchStart && !!lunchEnd &&
      this.toMin(prevEnd) === this.toMin(lunchStart) &&
      this.toMin(nextStart) === this.toMin(lunchEnd);

    const arr = [...segs].sort((a, b) => this.toMin(a.start) - this.toMin(b.start));
    const groups: { start: string; end: string }[][] = [];
    let cur: { start: string; end: string }[] = [];

    for (const s of arr) {
      if (!cur.length) { cur.push(s); continue; }
      const prev = cur[cur.length - 1];
      const gap = this.toMin(s.start) - this.toMin(prev.end);

      const contiguous = gap >= 0 && (
        gap <= gapToleranceMin || isLunchGap(prev.end, s.start)
      );

      if (contiguous) cur.push(s);
      else { groups.push(cur); cur = [s]; }
    }
    if (cur.length) groups.push(cur);
    return groups;
  }

  close(){ this.dialogRef.close({ ok:false }); }
}
