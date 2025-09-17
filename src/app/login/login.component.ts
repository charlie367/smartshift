import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import * as THREE from 'three';
import GLOBE from 'vanta/dist/vanta.globe.min';


type Label = string | ((v: Record<string, any>) => string);

interface Step {
  id: string;
  label: Label;
  key?: string;
  type?: 'text' | 'number' | 'password';
  placeholder?: string;
  required?: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule, MatIconModule, CommonModule, MatProgressBarModule,  ],
  templateUrl: './login.component.html',
  // styleUrl: './login.component.scss'
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy{

  constructor(private http: HttpClient,private router:Router,private el: ElementRef) {}
//動態背景
  private vantaEffect: any;
//在檢視初始化之後，畫面渲染完成後的操作
  ngAfterViewInit(): void {
    this.vantaEffect = GLOBE({
      el: "#vanta-bg",  // 對應 HTML 的背景容器
      THREE: THREE, //可以在網頁上畫出 3D 圖形、動畫、模型。
      mouseControls: true,
      touchControls: true,
      minHeight: 200.00,
      minWidth: 200.00,
      scale: 1.00,
      scaleMobile: 1.00,
      backgroundColor: 0x460bae, // 紫色背景
      color: 0x2e2428,           // 線條深灰色
      color2: 0xffffff,          // 點白色
      size: 0.5                  // 球體大小
    });
    this.focusInput();
  }
  //頁面上所有加了 #autoFocusInput 的 <input> 抓 多個元素/子元件（回傳一個集合 QueryList）
  @ViewChildren('autoFocusInput') autoFocusInputs!: QueryList<ElementRef<HTMLInputElement>>;
  //頁面上唯一加了 #passwordInput 的 <input> 抓 單一元素/子元件
  @ViewChild('passwordInput') passwordInput!: ElementRef<HTMLInputElement>;


  //key: string → 表示這個物件允許「任何字串」作為屬性名稱。
  //any → 表示這些屬性的值可以是「任何型別」。  
  form: {
    [key: string]: any;
    employeeId: string;
    newPassword: string;    // 改密碼用
    loginPassword: string;  // 登入用
  } = {
    employeeId: '',
    newPassword: '',
    loginPassword: ''
  };

  steps: Step[] = [
    { id: 'employeeId', label: '請輸入您的員工編號', key: 'employeeId', type: 'text', required: true, placeholder: '例如：BBBB0003' },
    //這是一個 函式，每次畫面需要顯示 label 的時候，Angular 都會重新呼叫它，傳進最新的 form。
    { id: 'newPassword', label: (v) => `您好 ${v['employeeId']}，請創建新密碼`, key: 'newPassword', type: 'password', required: true, placeholder: '請輸入新密碼' },
    { id: 'passwordSuccess', label: '處理中', required: false },
    { id: 'credentials', label: '請輸入您的員工編號與密碼', required: true },
    { id: 'done', label: '登入成功' }
  ];

  index = 0;

  //getter屬性每當用this.steps這個的時候就會回傳步驟

  get step() { return this.steps[this.index]; }
  
  private focusInput() {
    //延遲一段時間再執行某個函式
    setTimeout(() => {
  
      if (this.step.id === 'credentials' && this.passwordInput) {
        //ElementRef 是 Angular 幫你包裝的物件，真正的 DOM 元素存在 .nativeElement 裡。
        //游標自動跳進這個輸入框
        this.passwordInput.nativeElement.focus();
        return;
      }
      // 其他步驟：維持原本行為，聚焦第一個 #autoFocusInput
      const first = this.autoFocusInputs.first;
      first?.nativeElement.focus();
    });
  }


  //元件被銷毀 (destroy)
  ngOnDestroy(): void {
    if (this.vantaEffect) this.vantaEffect.destroy();
  }
  //資料的初始化
  ngOnInit(): void {}
//readonly → 代表這個值在程式運行時不能被改掉。
  private readonly TRANSITION_MS = 1300;
  isAnimating = false;
  private completed = false;
  private doneTimer?: any;
  show = true;
  idLocked: boolean = false;

  get displayLabel() {
    const s = this.steps[this.index];
    if (s.id === 'credentials') {
      return this.idLocked ? '請輸入您的密碼' : '請輸入您的員工編號與密碼';
    }
    const l = s.label;
    //typeof會抓這個數的類型
    return typeof l === 'function' ? l(this.form) : l;
  }



  get isLast() { return this.index >= this.steps.length - 1; }
  
  get canPrev() { return this.index > 0; }

  statusMsg: string = '正在新增密碼...';

  next() {
    if (!this.canGoNext() || this.isAnimating) return;

    this.isAnimating = true;
    //this.show = true; → 加上 show 這個 CSS class，畫面顯示卡片。
    //this.show = false; → 拿掉 show class，觸發 Angular 動畫 / CSS transition → 卡片開始淡出。
      this.show = false;

    setTimeout(() => {
      const targetIndex = Math.min(this.index + 1, this.steps.length - 1);
      const goingTo = this.steps[targetIndex];
      this.index = targetIndex;
      this.show = true;
      this.focusInput();

      // Step: 處理中（改密碼）
      if (goingTo.id === 'passwordSuccess') {
        // 想至少轉圈多久（避免太快就變成功）
        const MIN_SPIN_MS = 1000;   // 至少顯示「處理中」1秒
        const HOLD_SUCCESS_MS = 900; // 成功字樣停留多久再切下一步
        const startedAt = Date.now();
      
        this.statusMsg = '正在新增密碼...';
      
        this.http.post('http://localhost:8080/head/changePassword', {
          id: this.form.employeeId,
          newPassword: this.form.newPassword
        }).subscribe({
          next: (res: any) => {
            const code = res.code;
      
            // 計算還要等多久，讓「處理中」至少顯示 MIN_SPIN_MS
            const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
      
            if (code === 200) {
              setTimeout(() => {
                // 先把文字換成成功
                this.statusMsg = '密碼新增成功！';
                this.needsChangePassword = false;
           
      
                this.idLocked = true;          // 👈 改這裡：顯示「員工編號 + 密碼」
                this.form.loginPassword = '';   // 清空密碼，讓使用者重新輸入
                // 成功字樣再停留一下，然後帶動畫切到輸入密碼
                setTimeout(() => {
                  this.jumpTo('credentials');
                }, HOLD_SUCCESS_MS);
              }, wait);
            } else {
              setTimeout(() => {
                this.statusMsg = res.message || '密碼新增失敗';
                // 失敗就停在這頁讓使用者看到訊息，必要時自己再加返回邏輯
              }, wait);
            }
          },
          error: (err) => {
            const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt));
            setTimeout(() => {
              console.error('設定密碼失敗', err);
              this.statusMsg = '伺服器錯誤';
            }, wait);
          }
        });
      
        return; // 這裡 return，避免往下跑其他轉場邏輯
      }

    
     // 其餘步驟只是轉場
     this.isAnimating = false;
    }, this.TRANSITION_MS);
  }
  

  
  private jumpTo(toId: string) {
    this.isAnimating = true;
    this.show = false;
    setTimeout(() => {
      this.index = this.steps.findIndex(s => s.id === toId);
      this.show = true;
      this.focusInput();
      this.isAnimating = false;
    }, this.TRANSITION_MS);
  }

  private checkAccountStatus() {
    const raw = String(this.form.employeeId || '').trim();
    if (!raw) return;
  
    // ⚠ 如果你的 DB 員編是全大寫才改成 raw.toUpperCase()
    const id = raw; // or: const id = raw.toUpperCase();
    this.isAnimating = true;
  
    // 用 '0000' 當探測密碼
    const payload = { id, password: '0000' };
  
    this.http.post('http://localhost:8080/head/login', payload).subscribe({
      next: (res: any) => {
        const code = Number(res?.code ?? 0);
        // 標準化訊息：底線/連字號 → 空白，小寫化
        const msgNorm = String(res?.message ?? '')
          .toLowerCase()
          .replace(/[_-]+/g, ' ');
  
        // 狀態判斷
        const isNotFound =
          code === 404 || /not\s*found|查無|不存在/.test(msgNorm);
  
        // 後端若 DB=0000 會回 PIEASE_CHANGE_PASSWORD（含底線）
        const mustChange =
          code === 401 ||
          /change\s*password|piease\s*change\s*password|請.*(更改|變更|重設).*密碼/.test(msgNorm);
  
        // 若已改過，探測時用 0000 多半會回密碼不符/unauthorized
        const isPwdMismatch =
          /password\s*mismatch|密碼.*(錯|不正確|不符)|unauthorized/.test(msgNorm);
  
        if (isNotFound) {
          alert('查無此職員');
          this.reset();
          return;
        }
  
        if (mustChange) {
          // → 還是 0000，先換新密碼
          this.needsChangePassword = true;
          this.form.newPassword = '';
          this.idLocked = false;     // 顯示員編 + 新密碼欄
          this.jumpTo('newPassword');
          return;
        }
  
        // 走到這裡代表「已不是 0000」
        // 直接鎖住員編，請使用者輸入既有密碼登入
        if (isPwdMismatch || code === 200) {
          this.needsChangePassword = false;
          this.idLocked = true;       // ✅ 鎖住員編，只輸入密碼
          this.jumpTo('credentials');
          return;
        }
  
        // 其他非預期：也當成已改過，去輸入密碼
        this.needsChangePassword = false;
        this.idLocked = true;
        this.jumpTo('credentials');
      },
      error: (err) => {
        console.log('[login probe error]', err);
        alert(err?.error?.message || '伺服器錯誤');
        this.reset();
      }
    });
  }
  
  
  


onEnter() {
  if (!this.canGoNext() || this.isAnimating) return;

  // Step1：輸入員工編號後，先檢查是否需要改密碼
  if (this.step.id === 'employeeId') {
    this.checkAccountStatus();
    return;
  }

  // Step4：在輸入帳密頁，按 Enter 直接登入
  if (this.step.id === 'credentials') {
    this.onComplete();
    return;
  }

  if (this.isLast) this.onComplete();
  else this.next();
}


needsChangePassword: boolean = false;
// 放在 class 裡（若已存在可略過）
private blurActiveInput() {
  const el = document.activeElement as HTMLInputElement | null;
  el?.blur();
}

onComplete() {
  if (this.completed) return;
  this.completed = true;

  const payload = { id: this.form.employeeId, password: this.form.loginPassword };

  this.http.post('http://localhost:8080/head/login', payload).subscribe({
    next: (res: any) => {
      // 兼容字串/數字 code，並把 message 標準化（底線/連字號→空白、小寫）
      const code = typeof res?.code === 'string' ? parseInt(res.code, 10) : (Number(res?.code) || 0);
      const msgNorm = String(res?.message ?? '').toLowerCase().replace(/[_-]+/g, ' ').trim();

      // 1) 需要改密碼（DB 仍是 0000）
      if (code === 401 || /change\s*password|piease\s*change\s*password|請.*(更改|變更|重設).*密碼/.test(msgNorm)) {
        this.needsChangePassword = true;
        this.completed = false;
        this.form.newPassword = '';
        this.idLocked = false; // 改密碼步驟不顯示密碼欄，這裡保持 false 即可
        this.index = this.steps.findIndex(s => s.id === 'newPassword');
        this.show = true;
        this.focusInput();
        return;
      }

      // 2) 登入成功
      if (code === 200 || /success|ok/.test(msgNorm)) {
        this.blurActiveInput();           // 先失焦，避免殘影
        const HOLD_MS = 900;              // 停留時間可調整 600~1200ms
        this.jumpTo('done');              // 進「登入成功」卡片

        setTimeout(() => {
          setTimeout(() => {
            this.show = false;            // 退場動畫
            setTimeout(() => this.router.navigateByUrl('/scheduling'), this.TRANSITION_MS);
          }, HOLD_MS);
        }, this.TRANSITION_MS);
        return;
      }

      // 3) 查無此職員
      if (code === 404 || /not\s*found|查無|不存在/.test(msgNorm)) {
        this.completed = false;
        alert('查無此職員');
        this.reset();
        return;
      }

      // 4) 密碼不正確（已改過密碼但輸錯）
      if (code === 401 || /password\s*mismatch|密碼.*(錯|不正確|不符)|unauthorized/.test(msgNorm)) {
        this.completed = false;
        alert('密碼不正確');
        this.form.loginPassword = '';
        this.focusInput();
        return;
      }

      // 5) 其他錯誤
      this.completed = false;
      alert(res?.message || '登入失敗');
      this.reset();
    },
    error: (err) => {
      console.error('登入失敗', err);
      this.completed = false;
      alert(err?.error?.message || '伺服器錯誤');
      this.reset();
    }
  });
}





  prev() {
    if (!this.canPrev || this.isAnimating) return;
    this.isAnimating = true;

    if (this.doneTimer) { clearTimeout(this.doneTimer); this.doneTimer = undefined; this.completed = false; }

    this.show = false;
    setTimeout(() => {
      this.index = Math.max(this.index - 1, 0);
      this.show = true;
      this.focusInput();
      setTimeout(() => { this.isAnimating = false; }, this.TRANSITION_MS);
    }, this.TRANSITION_MS);
  }



  canGoNext(): boolean {
    const s = this.step;
    if (!s.key) {
      if (s.id === 'credentials') {
        const hasId  = this.idLocked || String(this.form.employeeId).trim().length > 0;
        const hasPwd = String(this.form.loginPassword).trim().length > 0;
        return hasId && hasPwd;
      }
      return s.id !== 'done';
    }
  
    const val = this.form[s.key];
    if (s.required) {
      if (s.type === 'text' || s.type === 'password') {
        return String(val ?? '').trim().length > 0;
      }
    }
    return true;
  }
  
  

  reset() {
    this.form = { name: '', age: null, employeeId: '', newPassword: '', loginPassword: '' };
    this.needsChangePassword = false;
    this.idLocked = false;     // ← 加這行
    this.index = 0;
    this.completed = false;
    if (this.doneTimer) { clearTimeout(this.doneTimer); this.doneTimer = undefined; }
    this.show = true;
    this.isAnimating = false;
    this.focusInput();
  }
  
}
  

