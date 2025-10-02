import { HttpClient } from '@angular/common/http';

import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BackEmployeeManger } from "../employee_manger/employee-manger";
import { BackNotifications } from "../notifications/notifications";
import { BackLeave } from '../leave/leave';
import { BackShift } from '../shift/shift';
import { BackOpinion } from '../opinion/opinion';
import { BackClock } from "../clock/clock";

@Component({
  selector: 'app-back-index',
  imports: [MatIconModule, BackEmployeeManger, BackLeave, BackNotifications, BackOpinion, BackShift, BackClock],
  templateUrl: './index.html',
  styleUrl: './index.scss'
})



export class BackIndex {

  //判斷畫面布林值
  isBackEmployeeManger = false;
  isBackClock = false;
  isBackOpinions = false;
  isBackLeave = false;
  isBackShift = false;
  isBackNotifications = false;


  //全域變數
  storeName: string = '八車';

  //切換方法
  toggleIcon(page: string) {
    this.isBackEmployeeManger = page === 'employee';
    this.isBackClock = page === 'clock';
    this.isBackOpinions = page === 'opinion';
    this.isBackLeave = page === 'leave';
    this.isBackShift = page === 'shift';
    this.isBackNotifications = page === 'notifications';
  }
}

