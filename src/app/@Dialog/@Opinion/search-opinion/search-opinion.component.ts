import { Component, Inject } from '@angular/core';
import { HttpClientService } from '../../../@Service/HttpClientService ';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-search-opinion',
  standalone: true,
  imports: [],
  templateUrl: './search-opinion.component.html',
  styleUrl: './search-opinion.component.scss'
})
export class SearchOpinionComponent {

  constructor(
    private http:HttpClientService,
    private dialogRef:MatDialogRef<SearchOpinionComponent>,
    @Inject(MAT_DIALOG_DATA) public employeeInfo:any
  ){}

  ngAfterViewInit(): void {
    this.http.getApi(`http://localhost:8080/opinion/searchById?id=${this.employeeInfo.id}`).subscribe((res:any)=>{
      this.opinionList = res.opinionList;
      this.analyze = res.analyze.split("/n");
    })
  }

  //全域變數
  opinionList:any[]=[]
  analyze:string[]=[];

  showOpinon(){
    this.dialogRef.close()
  }

}
