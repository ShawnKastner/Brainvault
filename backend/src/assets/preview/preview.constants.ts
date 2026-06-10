export const ASSET_PREVIEW_QUEUE = 'asset-preview';
export const ASSET_PREVIEW_JOB = 'generate-preview';
export const PDF_CONTENT_TYPE = 'application/pdf';

export const OFFICE_CONTENT_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export type PreviewErrorCode =
  | 'password_protected'
  | 'invalid_document'
  | 'unsupported_document'
  | 'conversion_timeout'
  | 'converter_unavailable'
  | 'preview_too_large';

export interface AssetPreviewJobData {
  assetId: string;
}
