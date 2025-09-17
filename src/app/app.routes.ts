import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SchedulingComponent } from './scheduling/scheduling.component';
import { LeaveFormComponent } from './leave-form/leave-form.component';


export const routes: Routes = [
    {path:'',component:LoginComponent},
    {path:'scheduling',component:SchedulingComponent},
    { path: 'leave', component: LeaveFormComponent },
  
];



