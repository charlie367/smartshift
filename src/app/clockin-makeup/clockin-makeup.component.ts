import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ClockinMakeupForm {
  employeeId: string;
  date: string;
  description: string;
  file: File | null;
}

@Component({
  selector: 'app-clockin-makeup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule],
  templateUrl: './clockin-makeup.component.html',
  styleUrls: ['./clockin-makeup.component.scss'],
})
export class ClockinMakeupComponent {
  form: ClockinMakeupForm = {
    employeeId: '',
    date: '',
    description: '',
    file: null,
  };

  fileName = '';
  previewUrl = '';

  constructor(
    private dialogRef: MatDialogRef<ClockinMakeupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<ClockinMakeupForm>
  ) {
    // 預填外部帶入的員工編號與日期
    this.form.employeeId = data.employeeId || '';
    this.form.date = data.date || '';
  }

  close() {
    this.dialogRef.close(false);
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.form.file = file;
    this.fileName = file.name;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => (this.previewUrl = String(reader.result || ''));
      reader.readAsDataURL(file);
    } else {
      this.previewUrl = '';
    }
  }

  reset() {
    this.form = { employeeId: '', date: '', description: '', file: null };
    this.fileName = '';
    this.previewUrl = '';
  }

  submit() {
    if (!this.form.employeeId || !this.form.date || !this.form.description) {
      alert('請填寫所有必填欄位');
      return;
    }

    
    console.log('提交資料：', this.form);
    alert('補打卡申請已送出！');
    this.dialogRef.close(true);
  }
}
