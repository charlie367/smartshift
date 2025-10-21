import { FormsModule } from '@angular/forms';
import { Component} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClientService } from '../../@Service/HttpClientService';
import { MatButtonModule } from '@angular/material/button';
import { AddNotifications } from '../../@Dialog/@Notify/add-notifications/add-notifications';
import { UpdateNotifications } from '../../@Dialog/@Notify/update-notifications/update-notifications';
import { MatIconModule } from "@angular/material/icon";


@Component({
  selector: 'app-back-notifications',
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class BackNotifications {

  //建構式
  constructor(
    private dialog: MatDialog,
    private http:HttpClientService
  ){}

  //初始化
  ngOnInit(): void {
    //取得該店家全部通知
    this.http.getApi(`http://localhost:8080/notify/searchAll`).subscribe((getAllnotifyRes:any)=>{
      this.notifyList = getAllnotifyRes.notifyList;
      this.originList = this.notifyList;
    })

    //搜尋
    this.filteredNotifyList = [...this.notifyList];
  }

  //全域變數
  notifyList:any[]=[];
  originList:any[]=[];
  filteredNotifyList: any[] = [];
  isDateError = false;
  filterStartDate=''
  filterEndDate=''

  //搜尋
  searchDate(){
    if(this.filterEndDate && this.filterStartDate > this.filterEndDate){
      this.isDateError = true;
    }else{
      this.isDateError = false;
    }

    if(!this.filterStartDate && !this.filterEndDate){
      this.notifyList = this.originList
    }

    // 篩選
    this.notifyList = this.originList.filter(item => {
      const itemDate = item.createdDate.slice(0, 10); // 確保格式為 YYYY-MM-DD

      if (this.filterStartDate && itemDate < this.filterStartDate) {
        return false;
      }
      if (this.filterEndDate && itemDate > this.filterEndDate) {
        return false;
      }
      return true;
    });
  }

  //新增通知Dialog
  showAddDialog() {
    const dialogRef = this.dialog.open(AddNotifications, {
      width: '520px',
      maxWidth: '90vw',
      maxHeight: '85vh',
      autoFocus: false,
      panelClass: 'custom-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    })
  }

  //更新通知Dialog
  showEditDialog(id:number) {
    const dialogRef = this.dialog.open(UpdateNotifications, {
      width: '600px',
      height: '450px',
      panelClass: 'custom-dialog',
      data:{
       id:id
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ngOnInit();
      }
    })
  }

  //跳網域
  routerUrl(event: MouseEvent, url: string){
    event.stopPropagation(); // 阻止觸發外層 div 的 click
    window.open("https://"+url)
  }
}
