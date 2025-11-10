// import { bootstrapApplication } from '@angular/platform-browser';
// import { appConfig } from './app/app.config';
// import { AppComponent } from './app/app.component';


//   bootstrapApplication(AppComponent, appConfig)
//   .catch((err) => console.error(err));

// 以下內容直接取代 main.ts 所有內容

import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [
    ...(appConfig.providers || []), // 保留原本的 providers
    provideAnimations(), // 啟用動畫
  ],
}).catch((err) => console.error(err));
