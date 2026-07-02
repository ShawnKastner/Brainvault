import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GotenbergClientService,
  PreviewConversionError,
} from '../assets/preview/gotenberg-client.service';
import { PagesService } from './pages.service';

export interface PagePdfExport {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class PagesPdfExportService {
  constructor(
    private readonly pagesService: PagesService,
    private readonly gotenberg: GotenbergClientService,
    private readonly config: ConfigService,
  ) {}

  async exportPage(id: string): Promise<PagePdfExport> {
    const page = await this.pagesService.findOne(id);
    const url = this.buildExportUrl(page.id);

    try {
      return {
        buffer: await this.gotenberg.convertUrlToPdf(url),
        filename: `${slugifyFilename(page.title)}.pdf`,
      };
    } catch (error) {
      if (error instanceof PreviewConversionError) {
        throw new ServiceUnavailableException('PDF-Export konnte nicht erstellt werden.');
      }
      throw error;
    }
  }

  private buildExportUrl(id: string): string {
    const baseUrl = this.config
      .get<string>('app.frontendExportBaseUrl', 'http://localhost:4200')
      .replace(/\/+$/, '');
    return `${baseUrl}/export/pages/${encodeURIComponent(id)}`;
  }
}

export function slugifyFilename(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'seite';
}
