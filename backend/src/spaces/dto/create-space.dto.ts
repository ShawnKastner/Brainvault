import { IsHexColor, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpaceDto {
  @ApiProperty({ example: 'Development' })
  @IsString()
  @MinLength(1)
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
