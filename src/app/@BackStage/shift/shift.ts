import { Component} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { HttpClientService } from '../../@Service/HttpClientService ';;
import { DayPilot, DayPilotModule } from '@daypilot/daypilot-lite-angular';
import { addMonths, endOfMonth, endOfWeek, format, getDaysInMonth, lastDayOfMonth, startOfMonth, startOfWeek } from 'date-fns';
import { MatButtonModule } from '@angular/material/button';
import { AddShiftWork } from '../../@Dialog/@Shift/add-shift-work/add-shift-work';
import { UpdateShiftWork } from '../../@Dialog/@Shift/update-shift-work/update-shift-work';
import { AddPreShiftComponent } from '../../@Dialog/@Shift/add-pre-shift/add-pre-shift.component';
import { AcceptShiftComponent } from '../../@Dialog/@Shift/accept-shift/accept-shift.component';


@Component({
  selector: 'app-back-shift',
  imports: [FormsModule,DayPilotModule,MatButtonModule],
  templateUrl: './shift.html',
  styleUrl: './shift.scss'
})
export class BackShift {
  //班表初始化
  events: DayPilot.EventData[] = [];
  config: DayPilot.SchedulerConfig = {
    startDate: "",
    days: 7,
    scale: "Hour",
    cellWidth: 70,
    rowHeaderWidth: 210,
    resources: [],
    eventMoveHandling: "Disabled",
    eventResizeHandling: "Disabled",
    // 自訂事件外觀
    onBeforeEventRender: (args) => {
      args.data.cssClass = "shift-event";
    },
    // ✅ 美化 row header
    onBeforeRowHeaderRender: (args) => {
      args.row.html = `
      <div class="row-header">
        <a
          href="javascript:void(0);"
          class="clickable-resource"
          data-id="${args.row.id}"
        >
          ${args.row.name}
        </a>
      </div>
      `;
    },
    onRowClicked: (args) => {
      this.showUpdateShiftWork(String(args.row.id));
    },
    onEventClicked: async (args:any) =>{
      this.showAcceptShift(args.e.cache);
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
    this.http.getApi(`http://localhost:8080/PreSchedule/getAllSchedule`).subscribe((res:any)=>{

      this.events = res.preScheduleList.map((item:any,index:number)=>{
        let text = '';
        let color = '';
        if(item.working == true && item.accept == true){
          text = "上班時段"
          color = "#B4F8C8";
        }else if(item.working == true && item.accept == false){
          text = "員工預排";
          color = "#A0E7E5"
        }else if(item.working == false && item.accept == true){
          text = "休假";
          color = "#FFAEBC";
        }else if(item.working == false && item.accept == false){
          text = "員工預休";
          color = "gray";
        }

        return{
          id:index+1,
          text:text,
          start:item.applyDate+"T"+item.startTime,
          end:item.applyDate+"T"+item.endTime,
          backColor:color,
          fontColor:"white",
          resource:item.employeeId,
          clickDisabled:!(text == "員工預排" || text == "員工預休")//必須是尚未確認的才能按
       }
      })
    })

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
    this.config.days = getDaysInMonth(this.today)
  }

  //全域變數
  branch_id!:number;
  employeeList:any[]=[];
  today = new Date();
  firstDayOfMonth=startOfMonth(this.today);


  //切換日週月
  currentView: 'day' | 'week' | 'month' = 'week';
  switchView(view:string) {
    if(view === 'day'){
      this.config.days = 1;
      this.config.startDate = new DayPilot.Date();
    }else if(view === 'week'){
      this.config.days = 7;
      this.config.startDate = new DayPilot.Date();
    }else{
      const monthEnd = endOfMonth(this.today);
      const lastWeekStart = startOfWeek(monthEnd, { weekStartsOn: 1 });
      let nextMonth = this.today >= lastWeekStart ? addMonths(this.today, 1) : this.today;
      this.config.startDate = new DayPilot.Date(format(startOfMonth(nextMonth), 'yyyy-MM-dd'));
      this.config.days = getDaysInMonth(nextMonth);
    }
  }

  //新增班表Dialog
  showShiftWork() {
    const dialogRef = this.dialog.open(AddShiftWork, {
      width: '500px',
      height: '500px',
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
      width: '500px',
      height: '500px',
      panelClass: 'custom-dialog',
      data: {
        employeeId:employeeId
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    });
  }


  //確認預排班
  showAcceptShift(eventInfo:any){
    const dialogRef = this.dialog.open(AcceptShiftComponent,{
      width:'300px',
      height:'200px',
      data:{
        data:eventInfo
      }
    })

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    })
  }

  // //開放預排班
  // showPreShiftWork(){
  //   this.dialog.open(AddPreShiftComponent,{
  //     width:'300px',
  //     height:'200px',
  //   })
  // }

  // //新增時段Dialog
  // showShiftTimeWork() {
  //   const dialogRef = this.dialog.open(AddShiftTime, {
  //     width: '40px',
  //     maxHeight: '90vh',
  //     panelClass: 'custom-dialog',
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.ngOnInit();
  //     }
  //   });
  // }

}
