import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../config/api-url.token';
import type { PdfAssetResponse } from '../models/storage.model';

@Injectable({ providedIn: 'root' })
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  getPdfs(): Observable<PdfAssetResponse[]> {
    return this.http.get<PdfAssetResponse[]>(`${this.apiUrl}/assets/pdfs`);
  }

  uploadPdf(file: File): Observable<PdfAssetResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<PdfAssetResponse>(`${this.apiUrl}/assets/pdfs`, formData);
  }

  deletePdf(id: string): Observable<void> {
    return this.http.delete<void>(this.getPdfUrl(id));
  }

  getPdfUrl(id: string): string {
    return `${this.apiUrl}/assets/pdfs/${encodeURIComponent(id)}`;
  }
}
