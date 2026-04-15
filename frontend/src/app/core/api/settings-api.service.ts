import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';
import type { AppSettings, UpdateSettingsRequest } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  get(): Observable<AppSettings> {
    return this.http.get<AppSettings>(`${this.apiUrl}/settings`);
  }

  update(request: UpdateSettingsRequest): Observable<AppSettings> {
    return this.http.patch<AppSettings>(`${this.apiUrl}/settings`, request);
  }
}
