import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import type { PreviewErrorCode } from './preview.constants';

export class PreviewConversionError extends Error {
  constructor(
    readonly code: PreviewErrorCode,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class GotenbergClientService {
  constructor(private readonly config: ConfigService) {}

  async convert(filePath: string, filename: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('app.previewConversionTimeoutMs', 120_000),
    );

    try {
      const form = new FormData();
      const input = await readFile(filePath);
      form.append('files', new Blob([input]), filename);

      const response = await fetch(
        `${this.config.get<string>('app.gotenbergUrl', 'http://localhost:3002')}/forms/libreoffice/convert`,
        {
          method: 'POST',
          body: form,
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1_000);
        throw this.mapHttpError(response.status, detail);
      }

      const configuredLimit = this.config.get<number>('app.maxPreviewBytes', 100 * 1024 * 1024);
      const announcedSize = Number(response.headers.get('content-length') ?? 0);
      if (announcedSize > configuredLimit) {
        throw new PreviewConversionError('preview_too_large', false, 'Preview exceeds size limit');
      }

      const output = Buffer.from(await response.arrayBuffer());
      if (output.length > configuredLimit) {
        throw new PreviewConversionError('preview_too_large', false, 'Preview exceeds size limit');
      }
      if (
        !response.headers.get('content-type')?.toLowerCase().startsWith('application/pdf') ||
        !output.subarray(0, 5).equals(Buffer.from('%PDF-'))
      ) {
        throw new PreviewConversionError('invalid_document', false, 'Converter returned invalid PDF');
      }

      return output;
    } catch (error) {
      if (error instanceof PreviewConversionError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new PreviewConversionError('conversion_timeout', true, 'Conversion timed out');
      }
      throw new PreviewConversionError(
        'converter_unavailable',
        true,
        error instanceof Error ? error.message : 'Converter unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkHealth(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(
        `${this.config.get<string>('app.gotenbergUrl', 'http://localhost:3002')}/health`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error(`Gotenberg health returned ${response.status}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapHttpError(status: number, detail: string): PreviewConversionError {
    const normalized = detail.toLowerCase();
    if (normalized.includes('password') || normalized.includes('encrypted')) {
      return new PreviewConversionError('password_protected', false, detail);
    }
    if (status === 400 || status === 422) {
      return new PreviewConversionError('invalid_document', false, detail);
    }
    if (status === 415) {
      return new PreviewConversionError('unsupported_document', false, detail);
    }
    return new PreviewConversionError('converter_unavailable', true, detail);
  }
}
