import { Component} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClientService } from '../../@Service/HttpClientService ';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AddNotifications } from '../../@Dialog/@Notify/add-notifications/add-notifications';
import { UpdateNotifications } from '../../@Dialog/@Notify/update-notifications/update-notifications';

@Component({
  selector: 'app-back-notifications',
  imports: [MatButtonModule],
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
    })
  }

  //全域變數
  notifyList:any[]=[];

  //新增通知Dialog
  showAddDialog() {
    const dialogRef = this.dialog.open(AddNotifications, {
      width: '600px',
      height: '450px',
      panelClass: 'custom-dialog',
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
