import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AiService {

  private apiUrl = 'http://localhost:8080/api/newtable'; // 後端 API

  constructor(private http: HttpClient) {}

  ask(date: string): Observable<any> {
    const payload = {
      selectedDate: date
    };
    return this.http.post(`${this.apiUrl}/ask`, payload);
  }
}
