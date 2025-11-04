import { Component, OnInit, OnDestroy, ViewEncapsulation, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { HttpClientService } from '../@Service/HttpClientService';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import { ClockinMakeupComponent } from '../clockin-makeup/clockin-makeup.component';
import { firstValueFrom, from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-reclockin',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './reclockin.component.html',
  styleUrls: ['./reclockin.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ReclockinComponent implements OnInit, OnDestroy {

  constructor(
    private dialogRef: MatDialogRef<ReclockinComponent>,
    private http: HttpClientService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog,
    private https: HttpClient
  ) {}

  // ===== UI 狀態 =====
  leftLabel = '🕐 上班打卡';
  rightLabel = '---';
  leftDisabled = false;
  rightDisabled = true;

  currentTime = '';
  currentDate = '';
  clockInTime: Date | null = null;
  clockOutTime: Date | null = null;
  restStart: Date | null = null;
  restEnd: Date | null = null;
  workDuration = '';

  showMoodRating = false;
  showModal = false;
  moodRating = 0;
  hoveredStar = 0;
  modalData = { icon: '✅', title: '', content: '' };
  private timerId: any;
  private isBusy = false;             // 防重複點擊

  mode: 'single' | 'lunch' | 'multi' = 'single';
  round = 1;

  // ===== 覆寫 postApi 用 =====
  private _origPostApi?: (url: string, body: any) => any;

  // ===== 住家圍欄設定（改這裡）=====
  private HOME = {
    lat: 22.61854,         // 你的家：22.618540...
    lng: 120.294441,       //        120.294441...
    radiusM: 200,          // 允許半徑（公尺）
    accuracyMax: 150       // 接受的最大精度（公尺）
  };

  ngOnInit(): void {
    if (!this.data.employeeId) {
      this.data.employeeId = localStorage.getItem('employeeId') || '';
    }
    if (!this.data.workDate) {
      this.data.workDate = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
    }

    // === 只在本元件有效的 postApi 包裝器（住家前端判斷 + 自動附座標）===
    {
      const augmentEndpoints = [/\/on$/, /\/rest\/start$/, /\/rest\/end$/, /\/clock\/off2$/];

      // 保存原方法，離開時在 ngOnDestroy 還原
      this._origPostApi = this.http.postApi.bind(this.http) as (url: string, body: any) => any;
      const originalPostApi = this._origPostApi;

      (this.http as any).postApi = (url: string, body: any) => {
        try {
          // 只攔四個打卡 API，其餘照舊
          if (!augmentEndpoints.some(r => r.test(url))) {
            return originalPostApi!(url, body);
          }

          // 1) 先做「住家」地理圍欄與精度檢查；不通過直接回錯（不打後端）
          return from(this.frontCheckHome().catch(() => ({ ok: false, msg: '無法取得定位，請允許網站取得位置' }))).pipe(
            mergeMap((chk: any) => {
              if (!chk.ok) {
                // 讓現有錯誤對話框吃到非 200 code
                return of({ code: 460, message: chk.msg });
              }
              // 2) 通過 → 再抓一次座標附上（給後端記錄）
              return from(this.getLatLngAcc().catch(() => null)).pipe(
                mergeMap((geo) => {
                  const merged = geo
                    ? { ...body, latitude: geo.latitude, longitude: geo.longitude, accuracy: geo.accuracy }
                    : body;
                  return originalPostApi!(url, merged);
                })
              );
            })
          );
        } catch {
          return originalPostApi!(url, body);
        }
      };
    }

    // === 你原本的初始化流程 ===
    this.tick();
    this.timerId = setInterval(() => this.tick(), 1000);

    const savedRound = localStorage.getItem('CLOCK_ROUND');
    if (savedRound) this.round = parseInt(savedRound, 10);

    const incoming: any[] = Array.isArray(this.data?.shifts) ? this.data.shifts : [];
    if (incoming.length) {
      this.mode = this.detectMode(incoming);
      this.updateButtons();
    } else {
      this.updateButtons();
      this.fetchTodayShifts(this.data.employeeId, this.data.workDate)
        .then(shifts => { this.mode = this.detectMode(shifts); this.updateButtons(); })
        .catch(() => { this.mode = 'single'; this.updateButtons(); });
    }

    this.loadTodayClock(); // 讀取今日狀態
  }

  ngOnDestroy(): void {
    // 還原 postApi，避免影響其他元件
    if (this._origPostApi) {
      (this.http as any).postApi = this._origPostApi;
    }
    clearInterval(this.timerId);
  }

  // ===== 位置相關 =====

  private getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('瀏覽器不支援定位'));
      navigator.geolocation.getCurrentPosition(
        resolve, reject,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  // 若你有環境檔可改成 environment.production
  private isDev(): boolean {
    return !/your-prod-domain\.com$/i.test(location.hostname);
  }

  // DEV_GEO 只在開發時可用（Console: localStorage.setItem('DEV_GEO','lat,lng,acc')）
  private readDevGeo(): { lat: number; lng: number; acc: number } | null {
    const raw = localStorage.getItem('DEV_GEO');
    if (!raw || !this.isDev()) return null;
    const [lat, lng, acc] = raw.split(',').map(Number);
    if ([lat, lng, acc].some(v => Number.isNaN(v))) return null;
    return { lat, lng, acc };
  }

  //「更聰明」抓定位：優先 DEV_GEO(僅 dev) → 多次取最佳 → 用快取備援
  private async getSmartGeo(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    const dev = this.readDevGeo();
    if (dev) {
      return { latitude: dev.lat, longitude: dev.lng, accuracy: dev.acc };
    }

    const TRIES = 3;
    let best: { latitude: number; longitude: number; accuracy: number } | null = null;

    for (let i = 0; i < TRIES; i++) {
      try {
        const pos = await this.getPosition();
        const g = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 999999
        };
        if (!best || g.accuracy < best.accuracy) best = g;
        if (g.accuracy <= 60) break; // 夠好了就不等了
      } catch {
        // 忽略一次失敗，繼續
      }
    }

    if (best) {
      localStorage.setItem('LAST_GOOD_GEO', JSON.stringify(best));
      return best;
    }

    const cached = localStorage.getItem('LAST_GOOD_GEO');
    if (cached) {
      return JSON.parse(cached);
    }

    throw new Error('定位失敗');
  }

  private async getLatLngAcc(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
    const dev = this.readDevGeo();
    if (dev) {
      return { latitude: dev.lat, longitude: dev.lng, accuracy: dev.acc };
    }
    const pos = await this.getPosition();
    const { latitude, longitude, accuracy } = pos.coords;
    return { latitude, longitude, accuracy };
  }

  private distanceMeters(lat1:number, lon1:number, lat2:number, lon2:number): number {
    const toRad = (d:number) => d * Math.PI / 180, R = 6371000;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) *
              Math.sin(dLon/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  private async frontCheckHome(): Promise<{ ok:boolean; msg:string; dist?:number; acc?:number }> {
    try {
      const g = await this.getSmartGeo();
      const dist = this.distanceMeters(g.latitude, g.longitude, this.HOME.lat, this.HOME.lng);
      const ACC  = Math.round(g.accuracy ?? 999999);
      const R    = this.HOME.radiusM;

      console.log('[GeoCheck]', { lat: g.latitude, lng: g.longitude, acc: ACC, dist: Math.round(dist) });

      // 嚴格規則：同時滿足兩個門檻才放行
      if (ACC <= this.HOME.accuracyMax && dist <= R) {
        return { ok:true, msg:'OK', dist, acc: ACC };
      }
      if (ACC > this.HOME.accuracyMax) {
        return { ok:false, msg:`定位精度不足（≈${ACC}m > ${this.HOME.accuracyMax}m）`, dist, acc: ACC };
      }
      return { ok:false, msg:`不在允許打卡範圍（距離≈${Math.round(dist)}m > ${R}m）`, dist, acc: ACC };
    } catch {
      return { ok:false, msg:'無法取得定位，請允許網站取得位置' };
    }
  }

  // ===== 其它：UI / 流程 =====

  openMakeupDialog() {
    const dialogRef = this.dialog.open(ClockinMakeupComponent, {
      width: '720px',
      panelClass: 'makeup-dialog-panel',
      data: {
        employeeId: this.data?.employeeId || localStorage.getItem('employeeId') || '',
        date: this.data?.workDate || new Date().toISOString().slice(0, 10),
      }
    });

    dialogRef.afterClosed().subscribe(ok => {
      if (ok) {
        this.loadTodayClock?.();
      }
    });
  }

  private async fetchTodayShifts(employeeId: string, workDate: string): Promise<any[]> {
    const res = await firstValueFrom(
      this.https.get<any>('http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId', {
        params: { employeeId }
      })
    );

    const normalize = (t?: string) => {
      if (!t) return '';
      const [hh='00', mm='00', ss='00'] = t.slice(0,8).split(':');
      return `${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
    };

    const list: any[] = res?.preScheduleList ?? [];
    return list
      .filter(s =>
        String(s.applyDate).slice(0,10) === workDate &&
        (Number(s.shiftWorkId ?? 0) > 0) &&
        s.accept === true
      )
      .map(s => ({
        start_time: normalize(s.startTime),
        end_time:   normalize(s.endTime),
        shift_work_id: Number(s.shiftWorkId ?? 0)
      }))
      .filter(s => s.start_time && s.end_time);
  }

  private tick() {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    this.currentTime =
      pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    this.currentDate =
      now.getFullYear() + '年' +
      (now.getMonth() + 1) + '月' +
      now.getDate() + '日 星期' + week;
  }

  private detectMode(shifts: any[]): 'single' | 'lunch' | 'multi' {
    if (!Array.isArray(shifts) || shifts.length === 0) return 'single';
    const list = shifts.map(s => ({
      swid: Number(s.shift_work_id ?? s.shiftWorkId ?? NaN),
      start: String(s.start_time ?? s.startTime ?? ''),
    })).filter(x => Number.isFinite(x.swid));

    if (list.some(x => x.swid === 0)) return 'single';
    const ordered = [...list].sort((a, b) => a.start.localeCompare(b.start));
    const n = ordered.length;
    if (n === 1) return 'single';
    if (n >= 3)  return 'multi';
    const a = ordered[0].swid, b = ordered[1].swid;
    const areConsecutive = (a === 1 && b === 2) || (a === 2 && b === 3) || (a === 3 && b === 4);
    return areConsecutive ? 'lunch' : 'multi';
  }

  private updateButtons(): void {
    if (this.mode === 'lunch') this.updateLunchButtons();
    else if (this.mode === 'multi') this.updateMultiButtons();
    else this.updateSingleButtons();
  }

  private updateSingleButtons() {
    if (!this.clockInTime) {
      this.leftLabel = '🕐 上班打卡';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.clockOutTime) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🕕 下班打卡';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else {
      this.leftLabel = this.rightLabel = '✅ 已完成';
      this.leftDisabled = this.rightDisabled = true;
    }
  }

  private updateLunchButtons() {
    if (!this.clockInTime) {
      this.leftLabel = '🕐 上班打卡';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.restStart) {
      this.leftLabel = '☕ 午休開始';
      this.rightLabel = '---';
      this.leftDisabled = false;
      this.rightDisabled = true;
    } else if (!this.restEnd) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🍱 午休結束';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else if (!this.clockOutTime) {
      this.leftLabel = '✅ 已完成';
      this.rightLabel = '🕕 下班打卡';
      this.leftDisabled = true;
      this.rightDisabled = false;
    } else {
      this.leftLabel = this.rightLabel = '✅ 已完成';
      this.leftDisabled = this.rightDisabled = true;
    }
  }

  private updateMultiButtons() {
    if (this.round === 1) {
      if (!this.clockInTime) {
        this.leftLabel = '🕐 第一段上班';
        this.rightLabel = '---';
        this.leftDisabled = false;
        this.rightDisabled = true;
      } else if (!this.clockOutTime) {
        this.leftLabel = '✅ 已完成';
        this.rightLabel = '🕕 第一段下班';
        this.leftDisabled = true;
        this.rightDisabled = false;
      } else {
        this.round = 2;
        this.clockInTime = null;
        this.clockOutTime = null;
        this.updateMultiButtons();
        localStorage.setItem('CLOCK_ROUND', '2');
      }
    } else if (this.round === 2) {
      if (!this.clockInTime) {
        this.leftLabel = '🕐 第二段上班';
        this.rightLabel = '---';
        this.leftDisabled = false;
        this.rightDisabled = true;
      } else if (!this.clockOutTime) {
        this.leftLabel = '✅ 已完成';
        this.rightLabel = '🕕 第二段下班';
        this.leftDisabled = true;
        this.rightDisabled = false;
      } else {
        this.leftLabel = this.rightLabel = '✅ 已完成';
        this.leftDisabled = this.rightDisabled = true;
      }
    }
  }

  // ===== 兩側按鈕動作 =====

  leftAction() {
    if (this.isBusy) return;
    if (this.mode === 'lunch') {
      if (!this.clockInTime) this.clockIn();
      else if (!this.restStart) this.startLunch();
    } else {
      this.clockIn();
    }
  }

  rightAction() {
    if (this.isBusy) return;
    if (this.mode === 'lunch') {
      if (!this.restEnd && this.restStart) this.endLunch();
      else if (!this.clockOutTime && this.restEnd) this.startClockOut();
    } else {
      this.startClockOut();
    }
  }

  // ===== 四個打卡 API（送出時已被 postApi 的地理圍欄攔住）=====

  private setBusy(v: boolean) {
    this.isBusy = v;
    this.leftDisabled = v || this.leftDisabled;
    this.rightDisabled = v || this.rightDisabled;
  }

  clockIn() {
    if (!this.data.employeeId) return;
    this.setBusy(true);
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, clockOn: now };

    this.http.postApi('http://localhost:8080/on', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.clockInTime = this.toDate(this.data.workDate, now);
          this.showSuccess('clockIn');
          this.updateButtons();
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
        this.setBusy(false);
      },
      error: () => {
        this.dialog.open(ErrorDialogComponent, { data: { message: '上班打卡錯誤' } });
        this.setBusy(false);
      }
    });
  }

  startLunch() {
    this.setBusy(true);
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, restStart: now };

    this.http.postApi('http://localhost:8080/rest/start', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.restStart = this.toDate(this.data.workDate, now);
          this.showSuccess('restStart');
          this.updateButtons();
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
        this.setBusy(false);
      },
      error: () => {
        this.dialog.open(ErrorDialogComponent, { data: { message: '上班打卡錯誤' } });
        this.setBusy(false);
      }
    });
  }

  endLunch() {
    this.setBusy(true);
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, workDate: this.data.workDate, restEnd: now };

    this.http.postApi('http://localhost:8080/rest/end', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.restEnd = this.toDate(this.data.workDate, now);
          this.showSuccess('restEnd');
          this.updateButtons();
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
        this.setBusy(false);
      },
      error: (err) => {
        console.error('❌ 午休結束錯誤:', err);
        this.setBusy(false);
      }
    });
  }

  startClockOut() {
    this.showMoodRating = true;
  }

  completeClockOut() {
    this.showMoodRating = false;
    this.setBusy(true);
    const selectedRating = this.hoveredStar || this.moodRating;
    const now = this.nowClockTime();
    const req = { employeeId: this.data.employeeId, clockOff: now, score: selectedRating };

    this.http.postApi('http://localhost:8080/clock/off2', req).subscribe({
      next: (res: any) => {
        if (res.code === 200) {
          this.clockOutTime = this.toDate(this.data.workDate, now);
          this.calcWorkDuration();
          this.showSuccess('clockOut', selectedRating);
          this.updateButtons();

          if (this.mode === 'multi' && this.round === 2) {
            localStorage.removeItem('CLOCK_ROUND');
            this.round = 1;
          }

          setTimeout(() => {
            this.moodRating = 0;
            this.hoveredStar = 0;
          }, 500);
        } else {
          this.dialog.open(ErrorDialogComponent, { data: { message: res.message } });
        }
        this.setBusy(false);
      },
      error: () => {
        this.dialog.open(ErrorDialogComponent, { data: { message: '伺服器錯誤' } });
        this.setBusy(false);
      }
    });
  }

  // ===== 時間與顯示 =====

  formatDisplayTime(date: Date | null): string {
    if (!date) return '--';
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const mi = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${y}/${m}/${d} ${h}:${mi}:${s}`;
  }

  private nowClockTime(): string {
    const dev = localStorage.getItem('DEV_CLOCK');
    return dev || new Date().toTimeString().substring(0, 8);
  }

  private toDate(dateStr: string, timeStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm, ss] = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, ss);
  }

  private calcWorkDuration() {
    if (!this.clockInTime || !this.clockOutTime) return;
    const diff = (this.clockOutTime.getTime() - this.clockInTime.getTime()) / 1000;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    this.workDuration = `${h}小時${m}分鐘`;
  }

  private loadTodayClock(): void {
    const workDate = (this.data.workDate ?? new Date().toISOString().slice(0, 10));
    const employeeId = this.data.employeeId;

    this.https.get<any>('http://localhost:8080/single/date', {
      params: { employeeId, workDate }
    }).subscribe({
      next: (res) => {
        if (res.code === 200 && Array.isArray(res.data) && res.data.length) {
          const latest = res.data[res.data.length - 1];
          if (latest.clockOn)  this.clockInTime  = new Date(`${latest.workDate}T${latest.clockOn}`);
          if (latest.clockOff) this.clockOutTime = new Date(`${latest.workDate}T${latest.clockOff}`);
          if (latest.restStart) this.restStart   = new Date(`${latest.workDate}T${latest.restStart}`);
          if (latest.restEnd)   this.restEnd     = new Date(`${latest.workDate}T${latest.restEnd}`);
          this.updateButtons();
        }
      },
      error: (err) => console.error('載入今日打卡狀態錯誤', err)
    });
  }

  showSuccess(type: 'clockIn' | 'clockOut' | 'restStart' | 'restEnd', score?: number) {
    const now = new Date();
    const timeStr = this.formatDisplayTime(now);
    if (type === 'clockOut') {
      const rating = typeof score === 'number' ? score : 0;
      const moodText = this.getMoodText(rating);
      const stars = Array.from({ length: 5 }, (_, i) =>
        `<span style="font-size:22px; color:${i < rating ? '#FFD700' : '#ccc'};">★</span>`
      ).join('');
      this.modalData = {
        icon: '✅',
        title: '下班打卡成功！',
        content: `
          <div style="text-align:center;">
            <p style="font-size:15px; color:#555;">打卡時間：<b>${timeStr}</b></p>
            <p style="font-size:15px; color:#333; margin:3px 0;">今日心情評分</p>
            <div style="margin:3px 0;">${stars}</div>
            <p style="font-size:14px; color:#444; margin:2px 0;">${moodText}</p>
            <p style="font-size:15px; color:#444; margin-top:4px;">
              今日工作時長：<b>${this.workDuration}</b>
            </p>
          </div>
        `
      };
    }
    else if (type === 'clockIn') {
      this.modalData = {
        icon: '✅',
        title: '上班打卡成功！',
        content: `
          <div style="text-align:center;">
            <p style="margin:6px 0; font-size:15px; color:#555;">
              打卡時間：<b>${timeStr}</b>
            </p>
            <p style="margin:6px 0; font-size:16px; color:#333;">祝您工作愉快！</p>
          </div>
        `
      };
    }
    else if (type === 'restStart') {
      this.modalData = {
        icon: '☕',
        title: '午休開始！',
        content: `
          <div style="text-align:center;">
            <p style="margin:6px 0; font-size:15px; color:#555;">時間：<b>${timeStr}</b></p>
            <p style="margin:6px 0; font-size:16px; color:#333;">好好休息一下吧 😌</p>
          </div>
        `
      };
    }
    else if (type === 'restEnd') {
      this.modalData = {
        icon: '🍱',
        title: '午休結束！',
        content: `
          <div style="text-align:center;">
            <p style="margin:6px 0; font-size:15px; color:#555;">時間：<b>${timeStr}</b></p>
            <p style="margin:6px 0; font-size:16px; color:#333;">回到崗位加油！💪</p>
          </div>
        `
      };
    }
    this.showModal = true;
  }

  closeModal() { this.showModal = false; }
  closeAndRefresh() { this.dialogRef.close(true); }
  setHoveredStar(s: number) { this.hoveredStar = s; }
  setMoodRating(s: number) { this.moodRating = s; }
  getMoodText(r: number) { return ['', '很糟糕 😞', '不太好 😕', '一般般 😐', '還不錯 😊', '非常好 😄'][r] || ''; }
  closeMoodRating() { this.showMoodRating = false; }
}
