import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSetting } from './entities/app-setting.entity';
import { toSettingsResponse } from './mappers/settings.mapper';
import { DEFAULT_APP_SETTINGS, DEFAULT_SETTINGS_SCOPE } from './settings.constants';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepo: Repository<AppSetting>,
  ) {}

  async findCurrent(): Promise<SettingsResponseDto> {
    const settings = await this.findOrCreateCurrentEntity();
    return toSettingsResponse(settings);
  }

  async updateCurrent(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const existing = await this.findCurrentEntity();
    const settings = existing ?? this.createCurrentEntity();

    if (dto.theme !== undefined) settings.theme = dto.theme;
    if (dto.compactNavigation !== undefined) {
      settings.compactNavigation = dto.compactNavigation;
    }
    if (dto.showReadingStats !== undefined) {
      settings.showReadingStats = dto.showReadingStats;
    }

    const saved = await this.settingsRepo.save(settings);
    return toSettingsResponse(saved);
  }

  private async findOrCreateCurrentEntity(): Promise<AppSetting> {
    const existing = await this.findCurrentEntity();
    if (existing) return existing;

    return this.settingsRepo.save(this.createCurrentEntity());
  }

  private findCurrentEntity(): Promise<AppSetting | null> {
    return this.settingsRepo.findOne({
      where: DEFAULT_SETTINGS_SCOPE,
    });
  }

  private createCurrentEntity(): AppSetting {
    return this.settingsRepo.create({
      ...DEFAULT_SETTINGS_SCOPE,
      ...DEFAULT_APP_SETTINGS,
    });
  }
}
