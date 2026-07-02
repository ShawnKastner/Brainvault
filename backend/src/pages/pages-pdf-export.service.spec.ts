import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  GotenbergClientService,
  PreviewConversionError,
} from '../assets/preview/gotenberg-client.service';
import { PagesPdfExportService, slugifyFilename } from './pages-pdf-export.service';
import { PagesService } from './pages.service';

describe(PagesPdfExportService.name, () => {
  let pages: jest.Mocked<Pick<PagesService, 'findOne'>>;
  let gotenberg: jest.Mocked<Pick<GotenbergClientService, 'convertUrlToPdf'>>;
  let service: PagesPdfExportService;

  beforeEach(() => {
    pages = {
      findOne: jest.fn().mockResolvedValue({
        id: '50b0b4a7-5115-42c4-bd08-1698e8e5f7a8',
        title: 'Überblick & Roadmap',
      }),
    };
    gotenberg = {
      convertUrlToPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
    };
    service = new PagesPdfExportService(
      pages as unknown as PagesService,
      gotenberg as unknown as GotenbergClientService,
      {
        get: jest.fn((key: string, fallback: unknown) =>
          key === 'app.frontendExportBaseUrl' ? 'http://frontend/' : fallback,
        ),
      } as unknown as ConfigService,
    );
  });

  it('builds the frontend export URL and filename', async () => {
    await expect(service.exportPage('50b0b4a7-5115-42c4-bd08-1698e8e5f7a8')).resolves.toEqual({
      buffer: Buffer.from('%PDF-1.7'),
      filename: 'uberblick-roadmap.pdf',
    });

    expect(gotenberg.convertUrlToPdf).toHaveBeenCalledWith(
      'http://frontend/export/pages/50b0b4a7-5115-42c4-bd08-1698e8e5f7a8',
    );
  });

  it('propagates missing pages', async () => {
    pages.findOne.mockRejectedValue(new NotFoundException('missing'));

    await expect(service.exportPage('50b0b4a7-5115-42c4-bd08-1698e8e5f7a8')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(gotenberg.convertUrlToPdf).not.toHaveBeenCalled();
  });

  it('maps converter failures to a service unavailable error', async () => {
    gotenberg.convertUrlToPdf.mockRejectedValue(
      new PreviewConversionError('converter_unavailable', true, 'unavailable'),
    );

    await expect(service.exportPage('50b0b4a7-5115-42c4-bd08-1698e8e5f7a8')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe(slugifyFilename.name, () => {
  it('falls back for titles without filename characters', () => {
    expect(slugifyFilename('---')).toBe('seite');
  });
});
