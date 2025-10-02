import { Component, Inject } from '@angular/core';
import { MatInputModule } from "@angular/material/input";
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectModule } from "@angular/material/select";
import { MatDatepickerModule } from '@angular/material/datepicker';
import { addDays, format, lastDayOfMonth } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { Fail } from '../../fail/fail';
import { Success } from '../../success/success';

@Component({
  selector: 'app-add-shift-work',
  imports: [MatInputModule, FormsModule, MatSelectModule, MatDatepickerModule, MatInputModule, MatDialogModule],
  templateUrl: './add-shift-work.html',
  styleUrl: './add-shift-work.scss'
})
export class AddShiftWork {

  //建構式
  constructor(
    private http: HttpClientService,
    private dialogRef: MatDialogRef<AddShiftWork>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public employeeInfo: any
  ) { }

  //初始化
  ngOnInit(): void {
    //取得在職員工
    this.employeeList = this.employeeInfo.employeeList;
  }

  //全域變數
  shiftList: any = {
    preSchduleUpdateVo: []
  }
  update: any = {
    employeeId: '',
    applyDate: '',
    working: true,
    shiftWorkId: '',
    accept: true
  };
  employeeList: any[] = [];
  timeList = ["06:00~11:00", "11:00~16:00", "16:00~21:00"]
  today = format(new Date, 'yyyy-MM-dd');
  tomorrow = format(addDays(this.today, 1), 'yyyy-MM-dd');

  //選定排班人員
  checkShift() {
    if(!this.update.employeeId){
      this.dialog.open(Fail, {width: '150px',data: { message: "員工ID尚未選取"}});
      return;
    }
    if(!this.update.applyDate){
      this.dialog.open(Fail, {width: '150px',data: { message: "日期尚未選取"}});
      return;
    }
    if(!this.update.shiftWorkId){
      this.dialog.open(Fail, {width: '150px',data: { message: "時段尚未選取"}});
      return;
    }
    const duplicate = this.shiftList.preSchduleUpdateVo.some(
      (item: any) => item.employeeId === this.update.employeeId && item.applyDate === this.update.applyDate
    );
    if(duplicate){
      this.dialog.open(Fail, {width: '150px', data: { message: "該員工此日期已選過排班" }});
      return;
    }
    this.shiftList.preSchduleUpdateVo.push({ ...this.update })
    this.update = {
      employeeId: '',
      applyDate: '',
      working: true,
      shiftWorkId: '',
      accept: true
    };
  }

  //取消已選排班人員
  checkCancel() {
    this.update = {
      employeeId: '',
      applyDate: '',
      working: true,
      shiftWorkId: '',
      accept: true
    };
  }

  //移除一筆待定班表
  removeShift(index: number) {
    this.shiftList.preSchduleUpdateVo.splice(index, 1);
  }

  //送出排班並新增
  async addShift() {
    if (this.shiftList.preSchduleUpdateVo.length === 0) {
      this.dialog.open(Fail, { width: '150px', data: { message: "尚未有任何排班" } });
      return;
    }

    const errors: string[] = [];

    for (let item of this.shiftList.preSchduleUpdateVo) {
      //抓可排班日期
      const work: any = await firstValueFrom(
        this.http.getApi(`http://localhost:8080/PreSchedule/getStaffCanWorkDay?employeeId=${item.employeeId}`)
      );

      //抓已排班資料
      const res: any = await firstValueFrom(
        this.http.getApi(`http://localhost:8080/PreSchedule/getAcceptScheduleByEmployeeId?employeeId=${item.employeeId}`)
      );

      //檢查是否那天有給班
      const canWorkDay = Array.isArray(work.applyDate) && work.applyDate.some((day: any) => day === item.applyDate);

      //檢查是否那天已有排班
      const exist = Array.isArray(res.preScheduleList) && res.preScheduleList.some((s: any) => s.applyDate === item.applyDate);

      if (exist) {
        errors.push(`${item.employeeId} ${item.applyDate} 該日期已排班`);
      } else if (!canWorkDay) {
        errors.push(`${item.employeeId} ${item.applyDate} 該日期尚未給班`);
      }
    }

    if (errors.length > 0) {
      this.dialog.open(Fail, { width: '150px', data: { message: errors.join('\n') } });
      return;
    }

    //都沒有錯更新預排班
    const postRes: any = await firstValueFrom(
      this.http.postApi(`http://localhost:8080/PreSchedule/update`, this.shiftList)
    );

    if (postRes.code === 200) {
      this.dialog.open(Success, { width: '150px' });
      this.dialogRef.close(true);
    } else {
      this.dialog.open(Fail, { width: '150px', data: { message: postRes.message } });
    }
  }

  //取消
  Oncancel() {
    this.dialogRef.close();
  }

}
