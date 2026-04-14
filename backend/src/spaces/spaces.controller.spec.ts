import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';

describe(SpacesController.name, () => {
  it('delegates patch updates to the service', async () => {
    const service = {
      update: jest.fn().mockResolvedValue({ id: 'space-id' }),
    } as unknown as SpacesService;
    const controller = new SpacesController(service);

    await expect(controller.patch('space-id', { name: 'Updated' })).resolves.toEqual({
      id: 'space-id',
    });
    expect(service.update).toHaveBeenCalledWith('space-id', { name: 'Updated' });
  });
});
