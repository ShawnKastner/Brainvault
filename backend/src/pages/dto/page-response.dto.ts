import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageContentFormat, PAGE_CONTENT_FORMATS } from '../entities/page.entity';

export class PageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  content: string | null;

  @ApiProperty({ enum: PAGE_CONTENT_FORMATS })
  contentFormat: PageContentFormat;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  spaceId: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
