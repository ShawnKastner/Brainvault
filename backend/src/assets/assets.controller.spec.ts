import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

describe(AssetsController.name, () => {
  it('rejects uploads without a file', async () => {
    const controller = new AssetsController({} as AssetsService);

    expect(() => controller.uploadImage()).toThrow(BadRequestException);
  });

  it('delegates image uploads to the service', async () => {
    const service = {
      saveImage: jest.fn().mockResolvedValue({
        id: 'asset-1',
        url: '/api/assets/images/file.png',
      }),
    } as unknown as AssetsService;
    const controller = new AssetsController(service);
    const file = {
      originalname: 'file.png',
      mimetype: 'image/png',
      size: 1,
      buffer: Buffer.from([1]),
    };

    await expect(controller.uploadImage(file)).resolves.toEqual({
      id: 'asset-1',
      url: '/api/assets/images/file.png',
    });
    expect(service.saveImage).toHaveBeenCalledWith(file);
  });


  it('delegates generic storage file operations to the service', async () => {
    const stream = Readable.from(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    const service = {
      listFiles: jest.fn().mockResolvedValue([{ id: 'file-1' }]),
      saveFile: jest.fn().mockResolvedValue({ id: 'file-1', url: '/api/assets/files/file-1' }),
      openFile: jest.fn().mockResolvedValue({
        stream,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: 'file.docx',
        originalName: 'report.docx',
        size: 4,
      }),
      ensureFileReadable: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as AssetsService;
    const controller = new AssetsController(service);
    const file = {
      originalname: 'report.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 4,
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    };

    await expect(controller.listFiles()).resolves.toEqual([{ id: 'file-1' }]);
    await expect(controller.uploadFile(file)).resolves.toEqual({
      id: 'file-1',
      url: '/api/assets/files/file-1',
    });
    await expect(controller.checkFile('file-1')).resolves.toBeUndefined();
    await expect(controller.getFile('file-1')).resolves.toBeDefined();
    await expect(controller.deleteFile('file-1')).resolves.toBeUndefined();
    expect(service.saveFile).toHaveBeenCalledWith(file);
    expect(service.ensureFileReadable).toHaveBeenCalledWith('file-1');
    expect(service.openFile).toHaveBeenCalledWith('file-1');
    expect(service.deleteFile).toHaveBeenCalledWith('file-1');
  });

  it('rejects PDF uploads without a file', async () => {
    const controller = new AssetsController({} as AssetsService);

    expect(() => controller.uploadPdf()).toThrow(BadRequestException);
  });

  it('delegates PDF operations to the service', async () => {
    const stream = Readable.from(Buffer.from('%PDF-1.7'));
    const service = {
      listPdfs: jest.fn().mockResolvedValue([{ id: 'pdf-1' }]),
      savePdf: jest.fn().mockResolvedValue({
        id: 'pdf-1',
        url: '/api/assets/pdfs/pdf-1',
      }),
      openPdf: jest.fn().mockResolvedValue({
        stream,
        contentType: 'application/pdf',
        filename: 'file.pdf',
        originalName: 'file.pdf',
        size: 12,
      }),
      ensurePdfReadable: jest.fn().mockResolvedValue(undefined),
      deletePdf: jest.fn().mockResolvedValue(undefined),
    } as unknown as AssetsService;
    const controller = new AssetsController(service);
    const file = {
      originalname: 'file.pdf',
      mimetype: 'application/pdf',
      size: 12,
      buffer: Buffer.from('%PDF-1.7'),
    };

    await expect(controller.listPdfs()).resolves.toEqual([{ id: 'pdf-1' }]);
    await expect(controller.uploadPdf(file)).resolves.toEqual({
      id: 'pdf-1',
      url: '/api/assets/pdfs/pdf-1',
    });
    await expect(controller.checkPdf('pdf-1')).resolves.toBeUndefined();
    await expect(controller.getPdf('pdf-1')).resolves.toBeDefined();
    await expect(controller.deletePdf('pdf-1')).resolves.toBeUndefined();
    expect(service.savePdf).toHaveBeenCalledWith(file);
    expect(service.ensurePdfReadable).toHaveBeenCalledWith('pdf-1');
    expect(service.openPdf).toHaveBeenCalledWith('pdf-1');
    expect(service.deletePdf).toHaveBeenCalledWith('pdf-1');
  });
});
