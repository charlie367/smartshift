import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-water-drop',
  standalone: true,
  imports: [],
  templateUrl: './waterdrop.component.html',
  styleUrl: './waterdrop.component.scss'
})
export class WaterdropComponent {
 // 之後可以透過這裡控制水位
 @Input() level: number = 60;

 setLevel(value: number) {
   this.level = value;
   document.documentElement.style.setProperty('--level', this.level.toString());
 }
}
