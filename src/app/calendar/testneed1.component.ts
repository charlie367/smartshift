import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';

type CellType = 'prev-month' | 'current-month' | 'next-month';
type DateCell = { date: Date; day: number; type: CellType; };
type SelectedRange = { start: Date | null; end: Date | null; };

@Component({
  selector: 'app-test-need1',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testneed1.component.html',
  styleUrls: ['./testneed1.component.scss'],
})
export class Testneed1Component implements OnInit {
  weekDays = ['日','一','二','三','四','五','六'];
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  weeks: DateCell[][] = [];

  selectedRange: SelectedRange = { start: null, end: null };

  @Output() rangeChange = new EventEmitter<SelectedRange>();
  @Output() dateClick = new EventEmitter<Date>();  // ★ 新增

  get currentMonthName(): string {
    const names = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    return names[this.currentMonth];
  }

  ngOnInit(): void {
    this.buildCalendar(this.currentYear, this.currentMonth);
  }

  changeMonth(delta: number) {
  const d = new Date(this.currentYear, this.currentMonth + delta, 1);
  this.currentYear = d.getFullYear();
  this.currentMonth = d.getMonth();
  this.selectedRange = { start: null, end: null }; // <- 清除選取（如果你想保留，拿掉這行）
  this.buildCalendar(this.currentYear, this.currentMonth);
}

  private buildCalendar(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = firstWeekday;
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const cells: DateCell[] = [];

    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const day = prevMonthLastDate - i;
      cells.push({ date: new Date(year, month - 1, day), day, type: 'prev-month' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), day: d, type: 'current-month' });
    }
    while (cells.length % 7 !== 0) {
      const nextIndex = cells.length - (prevMonthDays + daysInMonth) + 1;
      const nd = new Date(year, month + 1, nextIndex);
      cells.push({ date: nd, day: nd.getDate(), type: 'next-month' });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const nd = new Date(last); nd.setDate(nd.getDate() + 1);
      cells.push({ date: nd, day: nd.getDate(), type: 'next-month' });
    }

    this.weeks = [];
    for (let i = 0; i < 6; i++) this.weeks.push(cells.slice(i * 7, i * 7 + 7));
  }

  formatDateFull(d: Date | null): string {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${dd}`;
  }

  handleDateClick(cell: DateCell) {
  if (cell.type !== 'current-month') return;
  const clicked = this.toStartOfDay(cell.date);

  // 只做單日選取：把 start 設為 clicked，end 清空
  this.selectedRange = { start: clicked, end: null };
  // 通知父元件（你已在父元件使用 (dateClick)="onDateSelected($event)"）
  this.dateClick.emit(clicked);

  // 如果你還想讓父元件兼容 rangeChange 可以發一個簡短的 payload（start=end=nullable）
  this.rangeChange.emit({ ...this.selectedRange });
}


  isInRange(cell: DateCell): boolean {
  // 現在只在 start && end 都有時才會回 true（你已移除 end），因此預設 false
  const { start, end } = this.selectedRange;
  if (!start || !end) return false;
  const t = this.toStartOfDay(cell.date).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

getDateClasses(cell: DateCell): string {
  const classes: string[] = [];
  if (cell.type !== 'current-month') classes.push('outside-month');
  if (this.isToday(cell.date)) classes.push('today');

  const { start } = this.selectedRange;

  // 單日選取
  if (start && this.isSameDay(cell.date, start)) {
    classes.push('selected-single');
  }

  return classes.join(' ');
}

  private toStartOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private isSameDay(a: Date, b: Date): boolean { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  private isToday(d: Date): boolean { return this.isSameDay(d, new Date()); }
}
