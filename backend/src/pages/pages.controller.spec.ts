import { PagesController } from './pages.controller';
import { PagesPdfExportService } from './pages-pdf-export.service';
import { PagesService } from './pages.service';

describe(PagesController.name, () => {
  it('delegates patch updates to the service', async () => {
    const service = {
      update: jest.fn().mockResolvedValue({ id: 'page-id' }),
    } as unknown as PagesService;
    const controller = new PagesController(service, {} as PagesPdfExportService);

    await expect(controller.patch('page-id', { title: 'Updated' })).resolves.toEqual({
      id: 'page-id',
    });
    expect(service.update).toHaveBeenCalledWith('page-id', { title: 'Updated' });
  });

  it('returns a streamable PDF export', async () => {
    const pdfExport = {
      exportPage: jest.fn().mockResolvedValue({
        buffer: Buffer.from('%PDF-1.7'),
        filename: 'roadmap.pdf',
      }),
    } as unknown as PagesPdfExportService;
    const controller = new PagesController({} as PagesService, pdfExport);

    const result = await controller.exportPdf('page-id');

    expect(pdfExport.exportPage).toHaveBeenCalledWith('page-id');
    expect(result.getHeaders()).toEqual({
      type: 'application/pdf',
      disposition: 'attachment; filename="roadmap.pdf"',
      length: 8,
    });
  });
});
