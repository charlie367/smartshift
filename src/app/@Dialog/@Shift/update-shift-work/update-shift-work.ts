import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { addDays, format, lastDayOfMonth} from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { Fail } from '../../fail/fail';
import { Success } from '../../success/success';

@Component({
  selector: 'app-update-shift-work',
  imports: [FormsModule],
  templateUrl: './update-shift-work.html',
  styleUrl: './update-shift-work.scss'
})
export class UpdateShiftWork {
  //建構式
  constructor(
    private http:HttpClientService,
    private dialogRef:MatDialogRef<UpdateShiftWork>,
    private dialog:MatDialog,
    @Inject(MAT_DIALOG_DATA) public employeeInfo: any
  ){}

  //初始化
  ngOnInit(): void {
    this.http.getApi(`http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId?employeeId=${this.employeeInfo.employeeId}`).subscribe((res:any)=>{
      this.shiftList = res.preScheduleList
    })
  }

  //判斷編輯或是只讀
  isEdit = false;
  //全域變數
  tomorrow = format(addDays(new Date(),1),'yyyy-MM-dd');
  limit = format(lastDayOfMonth(this.tomorrow), 'yyyy-MM-dd');
  shiftList:any[]=[];
  timeList = ["06:00~11:00", "11:00~16:00", "16:00~21:00"]
  backupDate!:any;
  backupShiftWorkId!:any;

  //取消班表
  cancelShift(index:number){
    const body = {
      preSchduleUpdateVo:[{
        employeeId:this.shiftList[index].employeeId,
        applyDate:this.shiftList[index].applyDate,
        working:true,
        shiftWorkId:0,
        accept:false
      }]
    }
    this.http.postApi(`http://localhost:8080/PreSchedule/update`,body).subscribe((res:any)=>{
      if(res.code == 200){
        this.dialog.open(Success, { width: '150px' });
        this.dialogRef.close(true);
      }else{
        this.dialog.open(Fail, { width: '150px',data:{message:res.message}});
        return;
      }
    })
  }

  //更新班表
  async updateItem(index:number){
    if(!this.shiftList[index].applyDate){
      this.dialog.open(Fail,{width:'150px',data:{message:"日期為空"}})
      return;
    }

    const errors: string[] = [];

    //取可以上班的日期
    const work: any = await firstValueFrom(
      this.http.getApi(
        `http://localhost:8080/PreSchedule/getStaffCanWorkDay?employeeId=${this.shiftList[index].employeeId}`
      )
    );

    //取有同意的班表
    const res: any = await firstValueFrom(
      this.http.getApi(
        `http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId?employeeId=${this.shiftList[index].employeeId}`
      )
    );

    //檢查是否那天有給班
    const canWorkDay = Array.isArray(work.applyDate) && work.applyDate.some((day: any) => day === this.shiftList[index].applyDate);

    //檢查是否那天已有排班
    const exist = Array.isArray(res.preScheduleList) && res.preScheduleList.some((s: any) => s.applyDate === this.shiftList[index].applyDate);

    if (exist) {
      errors.push(`${this.shiftList[index].employeeId} ${this.shiftList[index].applyDate} 該日期已排班`);
    }else if(!canWorkDay){
      errors.push(`${this.shiftList[index].employeeId} ${this.shiftList[index].applyDate} 該日期尚未給班`);
    }

    if (errors.length > 0) {
      this.dialog.open(Fail, { width: '150px', data: { message: errors.join('\n') } });
      return;
    }

    //新班表
    const body = {
      preSchduleUpdateVo:[{
        employeeId: this.shiftList[index].employeeId,
        applyDate: this.shiftList[index].applyDate,
        shiftWorkId: this.shiftList[index].shiftWorkId,
        working: this.shiftList[index].working,
        accept: true
      }]
    };
    const postRes:any = await firstValueFrom(
      this.http.postApi(`http://localhost:8080/PreSchedule/update`,body)
    );

    //舊班表
    const oldbody={
      preSchduleUpdateVo:[{
        employeeId: this.shiftList[index].employeeId,
        applyDate: this.backupDate,
        working:true,
        shiftWorkId:0,
        accept:false
      }]
    }
    const oldRes:any = await firstValueFrom(
      this.http.postApi(`http://localhost:8080/PreSchedule/update`,oldbody)
    );

    //必須要兩個都是成功否則拋出是哪個錯誤
    if (postRes.code == 200 && oldRes.code == 200) {
      this.dialog.open(Success, { width: '150px' });
      this.dialogRef.close(true);
    }else {
      if(postRes.code != 200){this.dialog.open(Fail, {width: '150px', data: { message: postRes.message}});}
      if(oldRes.code != 200)this.dialog.open(Fail, {width: '150px', data: { message: oldRes.message}});
    }
  }

  //切換編輯並將舊日期值取出
  changeType(index:number){
    const data = this.shiftList[index];
    if (!data.isEdit) {
      this.backupDate = data.applyDate;
      this.backupShiftWorkId = data.shiftWorkId;
    }else{
      data.applyDate = this.backupDate ;
      data.shiftWorkId = this.backupShiftWorkId;
    }
    data.isEdit = !data.isEdit;
  }
}
