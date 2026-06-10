import type { Job } from 'bullmq';
import { AssetPreviewService } from './asset-preview.service';
import {
  GotenbergClientService,
  PreviewConversionError,
} from './gotenberg-client.service';
import type { AssetPreviewJobData } from './preview.constants';
import { PreviewProcessor } from './preview.processor';

describe(PreviewProcessor.name, () => {
  let previews: jest.Mocked<Pick<
    AssetPreviewService,
    'beginConversion' | 'completeConversion' | 'markFailed' | 'markPending'
  >>;
  let gotenberg: jest.Mocked<Pick<GotenbergClientService, 'convert'>>;
  let processor: PreviewProcessor;

  beforeEach(() => {
    previews = {
      beginConversion: jest.fn(),
      completeConversion: jest.fn(),
      markFailed: jest.fn(),
      markPending: jest.fn(),
    };
    gotenberg = { convert: jest.fn() };
    processor = new PreviewProcessor(
      previews as unknown as AssetPreviewService,
      gotenberg as unknown as GotenbergClientService,
    );
  });

  it('converts and completes a preview job', async () => {
    previews.beginConversion.mockResolvedValue({
      filePath: '/tmp/report.docx',
      filename: 'report.docx',
    });
    gotenberg.convert.mockResolvedValue(Buffer.from('%PDF-1.7'));

    await processor.process(createJob());

    expect(previews.completeConversion).toHaveBeenCalledWith(
      'asset-1',
      Buffer.from('%PDF-1.7'),
    );
  });

  it('persists permanent conversion failures without retrying', async () => {
    previews.beginConversion.mockResolvedValue({
      filePath: '/tmp/report.docx',
      filename: 'report.docx',
    });
    gotenberg.convert.mockRejectedValue(
      new PreviewConversionError('password_protected', false, 'protected'),
    );

    await processor.process(createJob());

    expect(previews.markFailed).toHaveBeenCalledWith('asset-1', 'password_protected');
    expect(previews.markPending).not.toHaveBeenCalled();
  });

  it('returns transient failures to BullMQ for retry', async () => {
    previews.beginConversion.mockResolvedValue({
      filePath: '/tmp/report.docx',
      filename: 'report.docx',
    });
    gotenberg.convert.mockRejectedValue(
      new PreviewConversionError('converter_unavailable', true, 'offline'),
    );

    await expect(processor.process(createJob())).rejects.toMatchObject({
      code: 'converter_unavailable',
    });
    expect(previews.markPending).toHaveBeenCalledWith('asset-1');
  });
});

function createJob(): Job<AssetPreviewJobData> {
  return {
    id: 'job-1',
    data: { assetId: 'asset-1' },
    opts: { attempts: 3 },
    attemptsMade: 0,
  } as Job<AssetPreviewJobData>;
}
