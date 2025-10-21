import { Component} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpClientService } from '../../@Service/HttpClientService';;
import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular';
import { addMonths, format, getDaysInMonth, startOfMonth} from 'date-fns';
import { MatButtonModule } from '@angular/material/button';
import { UpdateShiftWork } from '../../@Dialog/@Shift/update-shift-work/update-shift-work';
import { AcceptShiftComponent } from '../../@Dialog/@Shift/accept-shift/accept-shift.component';
import { MatIcon } from '@angular/material/icon';
import { AddShiftWork } from '../../@Dialog/@Shift/add-shift-work/add-shift-work';
import { Fail } from '../../@Dialog/fail/fail';
import { Success } from '../../@Dialog/success/success';


@Component({
  selector: 'app-back-shift',
  imports: [FormsModule, DayPilotModule, MatButtonModule, MatIcon, AcceptShiftComponent],
  templateUrl: './shift.html',
  styleUrl: './shift.scss'
})
export class BackShift {
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
    eventClickHandling:"Disabled",
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
    onRowClicked: (args) => {
      this.showUpdateShiftWork(String(args.row.id));
    }
  };

  //建構式
  constructor(
    private dialog:MatDialog,
    private http:HttpClientService
  ){}

  //初始化
  ngOnInit(): void {

    //取得班表
    this.http.getApi(`http://localhost:8080/PreSchedule/prettySchedule`).subscribe((res:any)=>{
      const events:any[]=[]
      res.employeeList.forEach((item:any) => {
        item.date.forEach((dateRes:any) => {
          let shifts: string[] = [];
          dateRes.shiftDetailList.forEach((shiftRes:any) => {
            if (shiftRes.accept) {
              switch (shiftRes.shiftWorkId) {
                case 0: shifts.push('休'); break;
                case 1: shifts.push('早'); break;
                case 2: shifts.push('中'); break;
                case 3: shifts.push('晚'); break;
                case 4: shifts.push('夜'); break;
              }
            }
            if (shifts.includes('休')) {
              shifts = ['休'];
            }
          });
          let text = shifts.join('｜')
          events.push({
            id: `${item.employeeId}-${dateRes.applyDate}`,
            text: text,
            start: `${dateRes.applyDate}T00:00:00`,
            end: `${dateRes.applyDate}T23:59:59`,
            fontColor: 'black',
            resource: item.employeeId, // 員工對應
          })
        });
      });

      this.events = events;
    });



    //取得在職員工
    this.http.getApi(`http://localhost:8080/head/searchAllNotResign`).subscribe((employeeRes:any)=>{
      this.employeeList = employeeRes.searchResList
      this.config.resources = employeeRes.searchResList.map((res:any)=>({
        name:res.name+"("+res.title+")",
        id:res.id
      }))
    })

    //設定班表月分與天數
    this.config.startDate =  new DayPilot.Date(format(this.firstDayOfMonth,'yyyy-MM-dd'));
    this.config.days = getDaysInMonth(this.firstDayOfMonth)
  }

  //全域變數
  preShiftCheck = false;
  employeeList:any[]=[];
  today = new Date();
  firstDayOfMonth = startOfMonth(this.today);
  currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');

  AutoShift(){
    this.http.getApi(`http://localhost:8080/shift`).subscribe((res:any)=>{
      if(res == 200){
        this.dialog.open(Success,{width:'150px'})
        this.ngOnInit()
      }else{
        this.dialog.open(Fail,{width:'150px',data:{message:"自動排班失敗"}});
      }
    })
  }


  // 上一個月
  previousMonth(): void {
    this.firstDayOfMonth = addMonths(this.firstDayOfMonth, -1);
    this.currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');
    this.ngOnInit();
  }

  // 下一個月
  nextMonth(): void {
    this.firstDayOfMonth = addMonths(this.firstDayOfMonth, 1);
    this.currentMonthLabel = format(this.firstDayOfMonth, 'yyyy 年 MM 月');
    this.ngOnInit();
  }

  //新增班表Dialog
  showShiftWork() {
    const dialogRef = this.dialog.open(AddShiftWork, {
      width: '700px',
      height: '80vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'custom-dialog',
      data: {
        employeeList:this.employeeList
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    });
  }

  //更新Dialog
  showUpdateShiftWork(employeeId:string) {
    const dialogRef = this.dialog.open(UpdateShiftWork, {
      width: '700px',
      height: '80vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'custom-dialog',
      data: {
        employeeId:employeeId,
        firstDayOfMonth:this.firstDayOfMonth
      }
    });

    dialogRef.backdropClick().subscribe(() => {
      dialogRef.close(true);
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    });
  }


  //確認預排班
  showAcceptShift(){
    this.preShiftCheck = !this.preShiftCheck
    this.ngOnInit()
  }

}
