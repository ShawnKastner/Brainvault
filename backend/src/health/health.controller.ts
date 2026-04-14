import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';

class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: '2026-04-14T15:00:00.000Z' })
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
