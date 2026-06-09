import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';
import type { StorageFileResponse } from '../models/storage.model';

@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getFiles(): Observable<StorageFileResponse[]> {
    return this.http.get<StorageFileResponse[]>(`${this.apiUrl}/assets/files`);
  }

  uploadFile(file: File): Observable<StorageFileResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<StorageFileResponse>(`${this.apiUrl}/assets/files`, formData);
  }

  deleteFile(id: string): Observable<void> {
    return this.http.delete<void>(this.getFileUrl(id));
  }

  checkFile(id: string): Observable<void> {
    return this.http.head<void>(this.getFileUrl(id));
  }

  getFileUrl(id: string): string {
    return `${this.apiUrl}/assets/files/${encodeURIComponent(id)}`;
  }
}
