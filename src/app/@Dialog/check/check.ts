import { Component, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { HttpClientService } from '../../@Service/HttpClientService';
import { Success } from '../success/success';
import { Fail } from '../fail/fail';

@Component({
  selector: 'app-check',
  templateUrl: './check.html',
  styleUrl: './check.scss',
})
export class Check {
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<Check>);
  private http = inject(HttpClientService);

  AutoShift() {
    this.http.getApi(`http://localhost:8080/shift`).subscribe((res: any) => {
      if (res === 200) {
        this.dialog.open(Success, {
          width: '150px',
          panelClass: 'custom-dialog-container',
        });
      } else {
        this.dialog.open(Fail, {
          width: '150px',
          data: { message: '自動排班失敗' },
        });
      }
      this.dialogRef.close();
    });
  }

  dialogClose() {
    this.dialogRef.close();
  }
}
