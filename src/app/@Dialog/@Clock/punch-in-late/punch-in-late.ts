import { Component } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { Success } from '../../success/success';
import { Fail } from '../../fail/fail';


@Component({
  selector: 'app-punch-in-late',
  imports: [FormsModule],
  templateUrl: './punch-in-late.html',
  styleUrl: './punch-in-late.scss'
})
export class PunchInLate {

  //建構式
  constructor(
    private http:HttpClientService,
    private dialog:MatDialog,
    private dialogRef:MatDialogRef<PunchInLate>,
  ){}

  //初始化
  ngOnInit(): void {
    //取得在職員工
    this.http.getApi(`http://localhost:8080/head/searchAllNotResign`).subscribe((res:any)=>{
      this.employeeList = res.searchResList
    })
  }

  //全域變數
  employeeList:any[]=[];
  check = false;
  clock:any={
    employeeId:'',
    workDate:'',
    clockOn:'',
    clockOff:'',
    hasDouble:''
  }

  //先檢查該員工選取日期的打卡
  checkFixClock(id:string){
    if(!id){
      this.dialog.open(Fail,{width:'150px',data:{message:"員工ID為空"}})
      return;
    }
    this.http.postApi(`http://localhost:8080/clock/fix/check`,this.clock).subscribe((res:any)=>{
      switch(res.status){
        case "MISS_OFF":
          this.clock = {
            employeeId: this.clock.employeeId,
            workDate: this.clock.workDate,
            clockOn: "",
            clockOff: this.clock.clockOff,
            score:0
          }
          this.check = false;
          alert(res.message)
          break;
        case "MISS_ON":
          this.clock = {
            employeeId: this.clock.employeeId,
            workDate: this.clock.workDate,
            clockOn: this.clock.clockOn,
            clockOff: "",
            score:0
          }
          this.check = false;
          alert(res.message)
          break;
        case "MISS_TWO":
          this.clock = {
            employeeId: this.clock.employeeId,
            workDate: this.clock.workDate,
            clockOn: this.clock.clockOn,
            clockOff: this.clock.clockOff,
            score:0
          }
          this.check = true;
          alert(res.message)
          break;
        default:
          return res.message;
      }
    })
  }

  //補打卡
  fixClock(){
    if(!this.check){
      this.http.postApi(`http://localhost:8080/clock/fix`,this.clock).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true);
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      });
    }else{
      this.http.postApi(`http://localhost:8080/clock/fix/create`,this.clock).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true);
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      });
    }
  }


}
