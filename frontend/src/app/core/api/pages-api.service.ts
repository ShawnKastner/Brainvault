import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';
import type { CreatePageRequest, PageResponse, UpdatePageRequest } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class PagesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getAll(spaceId?: string): Observable<PageResponse[]> {
    const params = spaceId ? new HttpParams().set('spaceId', spaceId) : undefined;
    return this.http.get<PageResponse[]>(`${this.apiUrl}/pages`, { params });
  }

  getOne(id: string): Observable<PageResponse> {
    return this.http.get<PageResponse>(`${this.apiUrl}/pages/${id}`);
  }

  create(request: CreatePageRequest): Observable<PageResponse> {
    return this.http.post<PageResponse>(`${this.apiUrl}/pages`, request);
  }

  update(id: string, request: UpdatePageRequest): Observable<PageResponse> {
    return this.http.patch<PageResponse>(`${this.apiUrl}/pages/${id}`, request);
  }

  replace(id: string, request: UpdatePageRequest): Observable<PageResponse> {
    return this.http.put<PageResponse>(`${this.apiUrl}/pages/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/pages/${id}`);
  }
}
