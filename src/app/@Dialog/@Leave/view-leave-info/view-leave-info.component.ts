import { Component, ViewChild } from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { ViewLeaveTimeComponent } from '../view-leave-time/view-leave-time.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-view-leave-info',
  imports: [MatTableModule, MatPaginatorModule],
  templateUrl: './view-leave-info.component.html',
  styleUrl: './view-leave-info.component.scss'
})
export class ViewLeaveInfoComponent {

  //列表
  displayedColumns: string[] = ['id', 'name', 'type', 'description','apply_date','approved'];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  constructor(
    private http:HttpClientService,
    private dialog:MatDialog
  ){}

  //初始化
  ngOnInit(): void {
    this.http.getApi(`http://localhost:8080/leave/getApprovedLeave`).subscribe((res:any)=>{
      this.dataSource.data = res
    })
  }

  showLeaveTime(id:number,prove:string){
    const dialogRef = this.dialog.open(ViewLeaveTimeComponent,{
      width:'3000px',
      height:'3000px',
      panelClass: 'custom-dialog',
      data:{
        id:id,
        prove:prove
      }
    })
  }
}
