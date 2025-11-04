import { Component, EventEmitter, Output,  } from '@angular/core';
import { HttpClientService } from '../../../@Service/HttpClientService';
import { addMonths, format, getDaysInMonth, startOfMonth } from 'date-fns';
import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular';
import { MatDialog } from '@angular/material/dialog';
import { AcceptComponent } from '../accept/accept.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: 'app-accept-shift',
  imports: [DayPilotModule, MatButtonModule, MatIconModule],
  templateUrl: './accept-shift.component.html',
  styleUrl: './accept-shift.component.scss'
})
export class AcceptShiftComponent {

  //建構式
  constructor(
    private http:HttpClientService,
    private dialog:MatDialog
  ){}

  //班表初始化
  events: DayPilot.EventData[] = [];
  config: DayPilot.SchedulerConfig = {
    scale: "Day",
    cellWidth: 50,
    rowHeaderWidth: 150,
    resources: [],
    timeHeaders: [
      { groupBy: "Day", format: "d" }
    ],
    eventMoveHandling: "Disabled",
    eventResizeHandling: "Disabled",
    // 自訂事件外觀
    onBeforeEventRender: (args) => {
      args.data.cssClass = "shift-event";

      // 拆解班別字串
      const shifts = args.data.text

      // 設定顏色
      const colorMap: any = {
        "早": "#E3F2FD",
        "中": "#FFF8E1",
        "晚": "#E8F5E9",
        "夜": "#E1BEE7",
        "休": "#FFEBEE",
      };

      const bgColor = colorMap[shifts[0]];


      args.data.html = `
        <div class="shift-box" style="background-color:${bgColor}">
          ${shifts}
        </div>
      `;

    },
    onEventClicked:(args:any)=>{
      let shiftId = 0;
      switch(args.e.cache.text){
        case "早班":
          shiftId = 1;
          break;
        case "中班":
          shiftId = 2;
          break;
        case "晚班":
          shiftId = 3;
          break;
        case "夜班":
          shiftId = 4;
          break;
      }
      const data = {
        preSchduleUpdateVo:[{
          employeeId: args.e.cache.resource,
          applyDate: format(new Date(args.e.cache.start.value),'yyyy-MM-dd'),
          shiftWorkId: shiftId,
          accept: true
        }]
      }
      const localData = {
        employeeId:args.e.cache.resource,
        applyDate:format(new Date(args.e.cache.start.value),'yyyy-MM-dd'),
        shift:args.e.cache.text
      }
      this.acceptShift(data,localData)
    }
  };

  //初始化
  ngOnInit(): void {
  // 取得所有 localStorage key 開頭為 preSchedule_
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('preSchedule_'));

  // 先清空 events
  this.events = [];

  allKeys.forEach(key => {
    const storedList = JSON.parse(localStorage.getItem(key) || '[]');
    storedList.forEach((item: any) => {
      this.events.push({
        id: `${item.employeeId}-${item.applyDate}-${item.shift}`,
        text: item.shift,
        start: `${item.applyDate}T00:00:00`,
        end: `${item.applyDate}T23:59:59`,
        fontColor: 'black',
        resource: item.employeeId
      });
    });
  });

  // 取得在職員工
  this.http.getApi(`http://localhost:8080/head/searchAllNotResign`).subscribe((employeeRes: any) => {
    this.config.resources = employeeRes.searchResList.map((res: any) => ({
      name: `${res.name} (${res.title})`,
      id: res.id
    }));
  });

  // 設定班表日期
  this.config.startDate = new DayPilot.Date(format(this.firstDayOfMonth, 'yyyy-MM-dd'));
  this.config.days = getDaysInMonth(this.firstDayOfMonth);
}

  //全域變數
  preShiftCheck = false;
  today = new Date();
  firstDayOfMonth=startOfMonth(addMonths(this.today,1));
  currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');

  // 上一個月
  previousMonth(): void {
    this.firstDayOfMonth = startOfMonth(addMonths(this.firstDayOfMonth, -1));
    this.currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');
    this.ngOnInit();
  }

  // 下一個月
  nextMonth(): void {
    this.firstDayOfMonth = startOfMonth(addMonths(this.firstDayOfMonth, 1));
    this.currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');
    this.ngOnInit();
  }

  //返回班表
  @Output() back = new EventEmitter<void>();
  goBack() {
    this.back.emit();
  }

  //是否同意預排
  acceptShift(data:any,localData:any){
    const dialogRef = this.dialog.open(AcceptComponent,{
      width:'100px',
      height:'200px',
      data:{
        shiftData:data,
        localData:localData
      }
    })
    dialogRef.afterClosed().subscribe(result=>{
      if(result == true){
        this.ngOnInit()
      }
    })
  }
}
