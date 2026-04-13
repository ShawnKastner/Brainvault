import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../app.config';
import type { Page, CreatePageDto, UpdatePageDto } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class PagesService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  getAll(spaceId?: string): Observable<Page[]> {
    const params = spaceId ? `?spaceId=${spaceId}` : '';
    return this.http.get<Page[]>(`${this.apiUrl}/pages${params}`);
  }

  getOne(id: string): Observable<Page> {
    return this.http.get<Page>(`${this.apiUrl}/pages/${id}`);
  }

  create(dto: CreatePageDto): Observable<Page> {
    return this.http.post<Page>(`${this.apiUrl}/pages`, dto);
  }

  update(id: string, dto: UpdatePageDto): Observable<Page> {
    return this.http.put<Page>(`${this.apiUrl}/pages/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/pages/${id}`);
  }
}
