import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  GotenbergClientService,
  PreviewConversionError,
} from './gotenberg-client.service';

describe(GotenbergClientService.name, () => {
  let directory: string;
  let filePath: string;
  let service: GotenbergClientService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'brainvault-gotenberg-'));
    filePath = join(directory, 'report.docx');
    await writeFile(filePath, Buffer.from('office'));
    service = new GotenbergClientService({
      get: jest.fn((key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  });

  it('accepts a valid PDF response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(Buffer.from('%PDF-1.7\npreview'), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );

    await expect(service.convert(filePath, 'report.docx')).resolves.toEqual(
      Buffer.from('%PDF-1.7\npreview'),
    );
  });

  it('maps password-protected conversion failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('document is password protected', { status: 400 }),
    );

    await expect(service.convert(filePath, 'report.docx')).rejects.toMatchObject<
      Partial<PreviewConversionError>
    >({
      code: 'password_protected',
      retryable: false,
    });
  });

  it('rejects non-PDF converter output', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('not a pdf', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(service.convert(filePath, 'report.docx')).rejects.toMatchObject({
      code: 'invalid_document',
    });
  });
});
