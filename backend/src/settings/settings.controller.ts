import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Einstellungen laden' })
  @ApiOkResponse({ type: SettingsResponseDto })
  findCurrent(): Promise<SettingsResponseDto> {
    return this.settingsService.findCurrent();
  }

  @Patch()
  @ApiOperation({ summary: 'Einstellungen aktualisieren' })
  @ApiOkResponse({ type: SettingsResponseDto })
  updateCurrent(@Body() dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return this.settingsService.updateCurrent(dto);
  }
}
