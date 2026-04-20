import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';

export interface ImageUploadResponse {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class ImagesApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  uploadImage(file: File): Observable<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ImageUploadResponse>(`${this.apiUrl}/assets/images`, formData);
  }
}
