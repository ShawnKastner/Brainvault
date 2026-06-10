import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concat, map, of, switchMap, takeWhile, timer } from 'rxjs';
import { StorageApiService } from '../../../core/api/storage-api.service';
import type {
  FilePreviewResponse,
  StorageFileResponse,
} from '../../../core/models/storage.model';

const PDF_CONTENT_TYPE = 'application/pdf';

export type DocumentPreviewState =
  | { state: 'checking' | 'pending' | 'processing' }
  | { state: 'ready'; url: string }
  | { state: 'failed'; errorCode: string | null }
  | { state: 'missing' | 'error' };

@Injectable({ providedIn: 'root' })
export class StoragePreviewService {
  private readonly storageApi = inject(StorageApiService);

  watch(file: StorageFileResponse): Observable<DocumentPreviewState> {
    return concat(
      of<DocumentPreviewState>({ state: 'checking' }),
      this.storageApi.checkFile(file.id).pipe(
        switchMap(() => this.startAndPoll(file)),
        catchError((error: unknown) =>
          of<DocumentPreviewState>({
            state: isNotFoundError(error) ? 'missing' : 'error',
          }),
        ),
      ),
    );
  }

  private startAndPoll(file: StorageFileResponse): Observable<DocumentPreviewState> {
    const initial$ =
      file.contentType === PDF_CONTENT_TYPE
        ? of(file.preview)
        : this.storageApi.requestPreview(file.id);

    return initial$.pipe(
      switchMap((initial) =>
        isTerminal(initial)
          ? of(initial)
          : concat(
              of(initial),
              timer(2_000, 2_000).pipe(
                switchMap(() => this.storageApi.getPreviewStatus(file.id)),
                takeWhile((preview) => !isTerminal(preview), true),
              ),
            ),
      ),
      map((preview) => this.toViewState(file, preview)),
    );
  }

  private toViewState(
    file: StorageFileResponse,
    preview: FilePreviewResponse,
  ): DocumentPreviewState {
    if (preview.status === 'ready') {
      return {
        state: 'ready',
        url: this.storageApi.getPreviewUrl(file.id),
      };
    }
    if (preview.status === 'failed') {
      return { state: 'failed', errorCode: preview.errorCode };
    }
    if (preview.status === 'processing') return { state: 'processing' };
    return { state: 'pending' };
  }
}

function isTerminal(preview: FilePreviewResponse): boolean {
  return preview.status === 'ready' || preview.status === 'failed';
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof HttpErrorResponse
    ? error.status === 404
    : typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}
