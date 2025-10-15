import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCalendar } from '@angular/material/datepicker';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';
import { ErrorDialogComponent } from '../error-dialog/error-dialog.component';
import { ShiftSelectDialogComponent } from '../shift-select-dialog/shift-select-dialog.component';

// 我定義了一個新的型別叫做 Cell，它的值可以是key or disabled，用法type 名字 = 某個型別;
// |聯合型別二擇一
type Cell = { key: string; disabled: boolean } | null;

@Component({
  selector: 'app-pre-schedule-dialog',
  standalone: true,
  imports: [MatCalendar, MatButtonModule, CommonModule, MatDialogModule, MatIconModule],
  templateUrl: './pre-schedule-dialog.component.html',
  styleUrls: ['./pre-schedule-dialog.component.scss']
})
export class PreScheduleDialogComponent implements OnInit {
  //?如果有值使用如果沒有值則回傳undefined
  selectedDates = new Map<
    string,
    {
      shift?: string;
      shift2?: string;
      note?: string;
      dayOff?: boolean;
      noPreference?: boolean;
      displayText?: string
    }
  >();

  weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

  private viewYear!: number;

  private viewMonth!: number;

  currentMonth!: number;

  monthName!: string;

  private monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<PreScheduleDialogComponent>
  ) { }

  unlockNextMonth = false;
  ngOnInit(): void {

    const today = new Date(2025, 9, 20); // 假設今天是 2025-10-20
    // const today = new Date();
    // 計算本月的第三個星期日 
    const thirdSunday = this.getThirdSunday(today.getFullYear(), today.getMonth());
    //new Date(year, monthIndex, day, hours, minutes, seconds)
    const unlockTime = new Date(today.getFullYear(), today.getMonth(), thirdSunday, 0, 0, 0);

    if (today >= unlockTime) {

      this.setMonth(today.getFullYear(), today.getMonth() + 2);
      //下個月是不是已經解鎖可以排班
      this.unlockNextMonth = true;
    } else {

      this.setMonth(today.getFullYear(), today.getMonth() + 1);
    }

    this.buildWeeks();
  }

  // 算出某年某月的第三個星期日日期 (回傳 day)
  private getThirdSunday(year: number, month: number): number {
    let date = new Date(year, month, 1); // 該月 1 號
    let sundayCount = 0;
    while (true) {
      if (date.getDay() === 0) { // 星期日
        sundayCount++;
        if (sundayCount === 3) {
          //取得目前的幾號
          return date.getDate();
        }
      }
      //把日期設成 n 號
      date.setDate(date.getDate() + 1);
    }
  }

  getWeeks(): Cell[][] { return this.weeks; }
  //因為日曆不是一條直線，而是「一個月被切成一週一週」。
  weeks: Cell[][] = [];

  private buildWeeks(): void {
    if (!this.viewYear || !this.viewMonth) {
      this.weeks = [];
      return;
    }

    // 把字串轉成物件或陣列
    const localData = JSON.parse(localStorage.getItem("preSchedule") || "[]");

    const filledDates = new Set(localData.map((x: any) => x.applyDate));

    // 算出月曆排版
    const firstDowMon0 = (new Date(this.viewYear, this.viewMonth - 1, 1).getDay() + 6) % 7;

    const daysInMonth = new Date(this.viewYear, this.viewMonth, 0).getDate();

    const pad2 = (n: number) => String(n).padStart(2, '0');

    // 今天的資訊
    const today = new Date();

    const thisYear = today.getFullYear();

    const thisMonth = today.getMonth() + 1;

    const cells: Cell[] = Array(firstDowMon0).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {

      const key = this.viewYear + '-' + pad2(this.viewMonth) + '-' + pad2(d);

      const isAlreadyFilled = filledDates.has(key);

      let allowedMonth = false;

      if (this.viewYear === thisYear && this.viewMonth === thisMonth) {
        allowedMonth = false;
      } else if (this.viewYear === thisYear && this.viewMonth === thisMonth + 1 && this.unlockNextMonth) {
        allowedMonth = true;   // 針對每一天去判斷可不可以點
      } else {
        allowedMonth = false;
      }
      cells.push({
        key,
        disabled: !allowedMonth || isAlreadyFilled
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    // 切成一週一週
    this.weeks = [];
    for (let i = 0; i < cells.length; i = i + 7) {
      this.weeks.push(cells.slice(i, i + 7));
    }
  }

  setMonth(y: number, m: number) {
    this.viewYear = y;
    this.viewMonth = m;
    this.currentMonth = m;
    this.monthName = this.monthNames[m - 1];
    this.buildWeeks();
  }

  prevMonth() {
    const d = new Date(this.viewYear, this.viewMonth - 2, 1);
    this.setMonth(d.getFullYear(), d.getMonth() + 1);
  }

  nextMonth() {
    const d = new Date(this.viewYear, this.viewMonth, 1);
    this.setMonth(d.getFullYear(), d.getMonth() + 1);
  }

  today = new Date();

  onCellClick(cell: Cell) {
    if (!cell || cell.disabled) return;

    const original = this.selectedDates.get(cell.key);

    const ref = this.dialog.open(ShiftSelectDialogComponent, {
      width: '510px',
      panelClass: 'shift-dialog-panel',
      data: {
        dateKey: cell.key,
        value: original ? { ...original } : undefined   // clone，避免即時修改
      },

    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.selectedDates.set(cell.key, result);
      }
    });
  }

  toggleDate(dateKey: string): void {
    if (this.selectedDates.has(dateKey)) {
      this.selectedDates.delete(dateKey); // 刪掉
    }
  }

  //把傳回來的集合變成陣列再用內建sort排好
  getSortedDates(): string[] {
    return Array.from(this.selectedDates.keys()).sort();
  }

  formatDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return y + "/" + m + "/" + d;
  }

  getWeekday(dateKey: string): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    return "星期" + this.weekdayNames[new Date(y, m - 1, d).getDay()];
  }

  clearAllDates(): void { this.selectedDates.clear(); }

  closeAndRefresh() { this.dialogRef.close(); }

  submitSchedule(): void {
    if (this.selectedDates.size === 0) {
      this.dialog.open(ErrorDialogComponent, {
        width: '320px',
        data: { message: '請先選擇排班日期！' }
      });
      return;
    }

    const employeeId = localStorage.getItem("employeeId") || "E001";

    const updateList: any[] = [];

    this.selectedDates.forEach((value, dateKey) => {
      if (value.dayOff) {
        updateList.push({ employeeId, applyDate: dateKey, shift: 0 });
        return;
      }
      if (value.noPreference) {
        updateList.push({ employeeId, applyDate: dateKey, shift: null });
        return;
      }
      if (value.shift) {
        updateList.push({ employeeId, applyDate: dateKey, shift: value.shift });
      }
      if (value.shift2) {
        updateList.push({ employeeId, applyDate: dateKey, shift: value.shift2 });
      }
    });
    // console.log("送出的排班內容:", updateList);
    const oldData = JSON.parse(localStorage.getItem("preSchedule") || "[]");
    const merged = [...oldData, ...updateList];
    //把陣列再轉成字串存進localStorage
    localStorage.setItem("preSchedule", JSON.stringify(merged));
    this.dialog.open(SuccessDialogComponent, {
      width: "300px",
      data: { message: "排班已送出！" }
    });
    this.selectedDates.clear();
    this.buildWeeks();
  }

  // export interface PreScheduleUpdateReq { preSchduleUpdateVo: PreSchduleUpdateVo[]; }

  // export interface PreSchduleUpdateVo {
  //   employeeId: string;
  //   applyDate: string;   // yyyy-MM-dd
  //   working: boolean;
  //   shiftWorkId: number;
  //   accept: boolean;
  // }

  // interface SelectedDateValue {
  //   shift?: string;
  //   shift2?: string;
  //   dayOff?: boolean;
  //   noPreference?: boolean;
  //   displayText?: string;   
  //   note?: string;
  // }

  //Set 就是 一個集合 (collection)，裡面放的值 不會重複。
  // private openByYM = new Map<string, Set<string>>();
  // 已由店長排好（禁用）
  // private blockedByYM = new Map<string, Set<string>>();

  // ngOnInit(): void {
  //   // 預設顯示「下個月」
  //   const today = new Date();
  //   this.setMonth(today.getFullYear(), today.getMonth() + 1);
  //   this.loadSchedule();
  // }

  // onCellClick(cell: Cell) {
  //   if (!cell || cell.disabled) return;
  //   this.toggleDate(cell.key);
  // }

  // //抓所有班
  // loadSchedule(): void {
  //   const employeeId = localStorage.getItem('employeeId') || '';
  //   this.scheduleService.getScheduleByEmployeeId(employeeId).subscribe({
  //     next: (res) => {
  //       const rows: any[] = res?.preScheduleList ?? [];
  //       // open：後端開放可預排的日期
  //       const openDates: string[] = rows.map(x => x.applyDate);
  //       this.openByYM.clear();
  //       for (const d of openDates) {
  //         const [y, m] = d.split('-').map(Number);
  //         const key = y + "-" + m;
  //         if (!this.openByYM.has(key)) this.openByYM.set(key, new Set());
  //         const set = this.openByYM.get(key);
  //         if (set) {
  //           set.add(d);
  //         }
  //       }
  //       // blocked：店長排班
  //       this.blockedByYM.clear();
  //       function toNum(v: boolean) {
  //         return v ? 1 : 0;
  //       }
  //       for (const r of rows) {
  //         const acceptRaw = r.accept;
  //         const shiftId = r.shiftWorkId;
  //         const isBlocked = toNum(acceptRaw) === 1 || shiftId > 0;
  //         if (isBlocked) {
  //           const d = r.applyDate;
  //           const [y, m] = d.split('-').map(Number);
  //           const key = y + "-" + m;
  //           if (!this.blockedByYM.has(key)) this.blockedByYM.set(key, new Set());
  //           this.blockedByYM.get(key)!.add(d);
  //         }
  //       }
  //       this.buildWeeks();
  //     },
  //     error: (err) => {
  //       this.dialog.open(ErrorDialogComponent,
  //         { data: { message: err?.error?.message || '伺服器錯誤' }, width: '280px' });
  //     }
  //   });
  // }


  // private buildWeeks(): void {
  //   if (!this.viewYear || !this.viewMonth) {
  //     this.weeks = [];
  //     return;
  //   }
  //   const ymKey = this.viewYear + "-" + this.viewMonth;
  //   const openSet = this.openByYM.get(ymKey) ?? new Set<string>();
  //   const blkSet = this.blockedByYM.get(ymKey) ?? new Set<string>();
  //   //算每個月的月初一號的預排班表應該會在星期幾
  //   const firstDowMon0 = (new Date(this.viewYear, this.viewMonth - 1, 1).getDay() + 6) % 7;
  //   const daysInMonth = new Date(this.viewYear, this.viewMonth, 0).getDate();
  //   const pad2 = (n: number) => String(n).padStart(2, '0');
  //   const cells: Cell[] = Array(firstDowMon0).fill(null);
  //   for (let d = 1; d <= daysInMonth; d++) {
  //     const key = this.viewYear + '-' + pad2(this.viewMonth) + '-' + pad2(d);
  //     const isOpen = openSet.has(key);
  //     const isBlk = blkSet.has(key);
  //     const cellDate = new Date(this.viewYear, this.viewMonth - 1, d);
  //     const isBeforeOrToday = cellDate <= this.today;
  //     cells.push({ key, disabled: !isOpen || isBlk || isBeforeOrToday });
  //   }
  //   while (cells.length % 7 !== 0) cells.push(null);
  //   this.weeks = [];
  //   for (let i = 0; i < cells.length; i = i + 7) this.weeks.push(cells.slice(i, i + 7));
  // }


  // submitSchedule(): void {
  //   if (this.selectedDates.size === 0) {
  //     this.dialog.open(ErrorDialogComponent, {
  //       width: '320px',
  //       disableClose: true,
  //       data: { message: '請先選擇排班日期！' },
  //       panelClass: 'no-padding-dialog'
  //     });
  //     return;
  //   }
  //   const employeeId = localStorage.getItem('employeeId') || 'E001';
  //   const updateList: PreSchduleUpdateVo[] = Array.from(this.selectedDates).map(dateKey => ({
  //     employeeId, applyDate: dateKey, working: false, shiftWorkId: 0, accept: false
  //   }));
  //   const req: PreScheduleUpdateReq = { preSchduleUpdateVo: updateList };

  //   this.scheduleService.updatePreSchedule(req).subscribe({
  //     next: () => {
  //       this.dialogRef.afterClosed().pipe(take(1)).subscribe(() => {
  //         //就是在「監聽 這個 Dialog 關閉的事件，而且只聽一次」。
  //         this.dialog.open(SuccessDialogComponent, { width: '320px', disableClose: true, panelClass: 'no-padding-dialog' });
  //       });
  //       this.dialogRef.close('success');
  //     },
  //     error: (err) => {
  //       this.dialog.open(ErrorDialogComponent, {
  //         width: '320px', disableClose: true,
  //         data: { message: err?.error?.message || '更新失敗，請稍後再試' },
  //         panelClass: 'no-padding-dialog'
  //       });
  //     }
  //   });
  // }
}
