export interface StorageFileResponse {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export type PdfAssetResponse = StorageFileResponse;
