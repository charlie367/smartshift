import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';


interface Notice {
  notify_id: number;
  notify_startTime: string;
  notify_endTime: string;
  notify_text: string;
}


@Component({
  selector: 'app-announcement-dialog',
  imports: [],
  templateUrl: './announcement-dialog.component.html',
  styleUrl: './announcement-dialog.component.scss'
})
export class AnnouncementDialogComponent {
  notifyList: Notice[] = [
    {
      notify_id: 1,
      notify_startTime: '2025-09-11',
      notify_endTime: '2025-09-12',
      notify_text: '這是一則測試公告'
    }
  ];

  constructor(private dialogRef: MatDialogRef<AnnouncementDialogComponent>) {}

  showEditDialog(notify: Notice) {
    console.log('編輯公告', notify);
    // 這裡可以開一個小表單 dialog 來編輯公告
  }

  close() {
    this.dialogRef.close();
  }
}
