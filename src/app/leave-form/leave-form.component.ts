import { FormsModule } from '@angular/forms';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { SuccessDialogComponent } from '../success-dialog/success-dialog.component';

@Component({
  selector: 'app-leave-form',
  imports: [FormsModule],
  templateUrl: './leave-form.component.html',
  styleUrl: './leave-form.component.scss'
})
export class LeaveFormComponent {

  constructor(private router:Router,private dialog: MatDialog) {}

  period: LeavePeriod[] = [];  // 一開始是空陣列

  // // 自由的 縮寫寫法， 不須建立額外 interface
  // period: any[] = [{
  //   leaveDate:[],
  //   startTime:[],
  //   endTime:[]
  // }];

  // ========= 請假系統 全域變數 =========
  employeeId: any;  // 員工ID
  leaveType: any; // 假別ID
  leaveDescription!: string; // 請假事由
  leaveDate: any; // 請假日期
  totalHour!: number; // 請假總時數

  leaveProve: any; //請假證明，上傳檔案

  startTime: any;  // 開始時間
  endTime: any;   // 結束時間


  leaveProveBase64: string[] = [];   // 存多個 base64
  previewUrls: string[] = [];        // 存多個預覽


  leave = {
    employeeId: "test1234",
    leaveType: "",
    leaveDescription: "",
    totalHours: "",
    leaveProve: [] as string[],// base64字串塞進JSON
    leavePeriod: this.period
  }

 
  // 新增時段
  addPeriod() {
    this.period.push({
      leave: '',
      startTime: '',
      endTime: ''
    });


    // this.period.push({}); // 上面程式碼的縮寫
  }

 
  deletePeriod(index: number) {
   this.period.splice(index, 1);
  }

  sendJSON1(){
    this.router.navigate(['/scheduling']); 
  }
  sendJSON() {
    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px'
    });
  
    confirmRef.afterClosed().subscribe(result => {
      if (result) {
        // console.log('送出的資料:', this.userComment);
  
        // 如果這裡沒有 dialogRef，單純導頁
        this.router.navigate(['/scheduling']);
  
        // 成功提示
        this.dialog.open(SuccessDialogComponent, {
          width: '300px'
        });
      } else {
        console.log('使用者取消送出');
      }
    });
  }


  // 當 input[type=file] 變更時觸發
  onFileSelected(event: any) {

    const files: FileList = event.target.files;



    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          this.leaveProveBase64.push(base64);
          this.previewUrls.push(base64);

          // 更新 leave 物件
          this.leave.leaveProve = [...this.leaveProveBase64];
        };
        reader.readAsDataURL(file);
      });
    }
  }



  removeFile(index: number) {
    this.previewUrls.splice(index, 1);
    this.leaveProveBase64.splice(index, 1);
  }

  clearFiles() {
    this.previewUrls = [];
    this.leaveProveBase64 = [];
  }


  //=======================



  // 請假時數規則
  // 命名規則 12.5 之類的計算 (請假時數 12小時 + 半小時 = 12.5)
  // 15分鐘以上 30分鐘以內(包含) 等於 0.5


  // 圖片可以預覽，並且可以取消上傳

  // 請假證明，改成 base64 放進JSON (base64 是字串)



}

// 建一個介面，讓結構更清楚
interface LeavePeriod {
  leave: string;      // 日期
  startTime: string;  // 開始時間
  endTime: string;    // 結束時間
}

