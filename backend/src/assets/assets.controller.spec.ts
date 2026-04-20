import { BadRequestException } from '@nestjs/common';
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
});
