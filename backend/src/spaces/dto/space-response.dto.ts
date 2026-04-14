import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageResponseDto } from '../../pages/dto/page-response.dto';

export class SpaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  color: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class SpaceWithPagesResponseDto extends SpaceResponseDto {
  @ApiProperty({ type: [PageResponseDto] })
  pages: PageResponseDto[];
}
