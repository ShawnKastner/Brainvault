import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../app.config';
import type { Space, SpaceWithPages, CreateSpaceDto, UpdateSpaceDto } from '../models/space.model';

@Injectable({ providedIn: 'root' })
export class SpacesService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL);

  getAll(): Observable<SpaceWithPages[]> {
    return this.http.get<SpaceWithPages[]>(`${this.apiUrl}/spaces`);
  }

  getOne(id: string): Observable<SpaceWithPages> {
    return this.http.get<SpaceWithPages>(`${this.apiUrl}/spaces/${id}`);
  }

  create(dto: CreateSpaceDto): Observable<Space> {
    return this.http.post<Space>(`${this.apiUrl}/spaces`, dto);
  }

  update(id: string, dto: UpdateSpaceDto): Observable<Space> {
    return this.http.put<Space>(`${this.apiUrl}/spaces/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/spaces/${id}`);
  }
}
