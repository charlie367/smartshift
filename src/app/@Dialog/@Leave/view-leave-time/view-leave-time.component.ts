import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Component, Inject } from '@angular/core';
import { HttpClientService } from '../../../@Service/HttpClientService ';

@Component({
  selector: 'app-view-leave-time',
  imports: [],
  templateUrl: './view-leave-time.component.html',
  styleUrl: './view-leave-time.component.scss'
})
export class ViewLeaveTimeComponent {

  //建構式
  constructor(
    private http:HttpClientService,
    @Inject(MAT_DIALOG_DATA) public leaveData:any
  ){}

  //初始化
  ngOnInit(): void {
    this.http.getApi(`http://localhost:8080/leave/getLeaveByleaveId?leaveId=${this.leaveData.id}`).subscribe((res:any)=>{
      this.leaveInfoList = res;
    })
  }

  //全域變數
  leaveInfoList:any[]=[];
}
