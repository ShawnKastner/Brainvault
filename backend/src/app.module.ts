import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config';
import { databaseConfig } from './database/database.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';
import { SettingsModule } from './settings/settings.module';
import { validateEnvironment } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    SpacesModule,
    PagesModule,
    SettingsModule,
  ],
})
export class AppModule {}
