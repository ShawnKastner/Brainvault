export type FilePreviewStatus = 'not_required' | 'pending' | 'processing' | 'ready' | 'failed';

export interface FilePreviewResponse {
  status: FilePreviewStatus;
  url: string | null;
  errorCode: string | null;
}

export interface StorageFileResponse {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  preview: FilePreviewResponse;
}

export type PdfAssetResponse = StorageFileResponse;
