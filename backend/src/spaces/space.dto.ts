import { IsString, IsOptional, IsHexColor, IsInt, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateSpaceDto {
  @ApiProperty({ example: 'Development' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Alle Dev-Notizen' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#378ADD' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {}
