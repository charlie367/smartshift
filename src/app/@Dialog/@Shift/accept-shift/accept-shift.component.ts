import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Component, Inject } from '@angular/core';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { Success } from '../../success/success';
import { Fail } from '../../fail/fail';
import { format } from 'date-fns';

@Component({
  selector: 'app-accept-shift',
  imports: [],
  templateUrl: './accept-shift.component.html',
  styleUrl: './accept-shift.component.scss'
})
export class AcceptShiftComponent {

  //建構式
  constructor(
    private http:HttpClientService,
    private dialog:MatDialog,
    private dialogRef:MatDialogRef<AcceptShiftComponent>,
    @Inject(MAT_DIALOG_DATA) public eventInfo: any
  ){}

  //同意
  accept(){
    if(this.eventInfo.data.text == "員工預排"){
      const data = {
        preSchduleUpdateVo:[{
          employeeId:this.eventInfo.data.resource,
          applyDate:format(this.eventInfo.data.start.toDate(),'yyyy-MM-dd'),
          working:true,
          shiftWorkId:null,
          accept:true
        }]
      }

      this.http.postApi(`http://localhost:8080/PreSchedule/update`,data).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true)
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      })

    }else if(this.eventInfo.data.text == "員工預休"){
      const data = {
        preSchduleUpdateVo:[{
          employeeId:this.eventInfo.data.resource,
          applyDate:format(this.eventInfo.data.start.toDate(),'yyyy-MM-dd'),
          working:false,
          shiftWorkId:0,
          accept:true
        }]
      }

      this.http.postApi(`http://localhost:8080/PreSchedule/update`,data).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true)
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      })
    }

  }

  //不同意
  disagree(){
    if(this.eventInfo.data.text == "員工預排"){
      const data = {
        preSchduleUpdateVo:[{
          employeeId:this.eventInfo.data.resource,
          applyDate:format(this.eventInfo.data.start.toDate(),'yyyy-MM-dd'),
          working:true,
          shiftWorkId:0,
          accept:false
        }]
      }
      console.log(data)
      this.http.postApi(`http://localhost:8080/PreSchedule/update`,data).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true)
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      });
    }else if(this.eventInfo.data.text == "員工預休"){
      const data = {
        preSchduleUpdateVo:[{
          employeeId:this.eventInfo.data.resource,
          applyDate:format(this.eventInfo.data.start.toDate(),'yyyy-MM-dd'),
          working:true,
          shiftWorkId:0,
          accept:false
        }]
      }
      this.http.postApi(`http://localhost:8080/PreSchedule/update`,data).subscribe((res:any)=>{
        if(res.code == 200){
          this.dialog.open(Success,{width:'150px'});
          this.dialogRef.close(true)
        }else{
          this.dialog.open(Fail,{width:'150px',data:{message:res.message}});
          return;
        }
      });
    }
  }
}
