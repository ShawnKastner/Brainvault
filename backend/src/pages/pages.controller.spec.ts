import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

describe(PagesController.name, () => {
  it('delegates patch updates to the service', async () => {
    const service = {
      update: jest.fn().mockResolvedValue({ id: 'page-id' }),
    } as unknown as PagesService;
    const controller = new PagesController(service);

    await expect(controller.patch('page-id', { title: 'Updated' })).resolves.toEqual({
      id: 'page-id',
    });
    expect(service.update).toHaveBeenCalledWith('page-id', { title: 'Updated' });
  });
});
