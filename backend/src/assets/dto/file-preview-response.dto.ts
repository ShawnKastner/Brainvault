import { ApiProperty } from '@nestjs/swagger';
import type { AssetPreviewStatus } from '../entities/asset.entity';

export class FilePreviewResponseDto {
  @ApiProperty({
    enum: ['not_required', 'pending', 'processing', 'ready', 'failed'],
    example: 'ready',
  })
  status: AssetPreviewStatus;

  @ApiProperty({
    example: '/api/assets/files/6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09/preview',
    nullable: true,
  })
  url: string | null;

  @ApiProperty({ example: null, nullable: true })
  errorCode: string | null;
}
