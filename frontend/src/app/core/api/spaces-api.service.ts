import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';
import type {
  CreateSpaceRequest,
  SpaceWithPagesResponse,
  UpdateSpaceRequest,
} from '../models/space.model';

@Injectable({ providedIn: 'root' })
export class SpacesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getAll(): Observable<SpaceWithPagesResponse[]> {
    return this.http.get<SpaceWithPagesResponse[]>(`${this.apiUrl}/spaces`);
  }

  getOne(id: string): Observable<SpaceWithPagesResponse> {
    return this.http.get<SpaceWithPagesResponse>(`${this.apiUrl}/spaces/${id}`);
  }

  create(request: CreateSpaceRequest): Observable<SpaceWithPagesResponse> {
    return this.http.post<SpaceWithPagesResponse>(`${this.apiUrl}/spaces`, request);
  }

  update(id: string, request: UpdateSpaceRequest): Observable<SpaceWithPagesResponse> {
    return this.http.patch<SpaceWithPagesResponse>(`${this.apiUrl}/spaces/${id}`, request);
  }

  replace(id: string, request: UpdateSpaceRequest): Observable<SpaceWithPagesResponse> {
    return this.http.put<SpaceWithPagesResponse>(`${this.apiUrl}/spaces/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/spaces/${id}`);
  }
}
