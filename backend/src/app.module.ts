import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpacesModule } from './spaces/spaces.module';
import { PagesModule } from './pages/pages.module';
import { Space } from './spaces/space.entity';
import { Page } from './pages/page.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get<string>('DB_NAME', 'brainvault'),
        username: config.get<string>('DB_USER', 'brainvault'),
        password: config.get<string>('DB_PASS', 'brainvault_secret'),
        entities: [Space, Page],
        synchronize: true,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    SpacesModule,
    PagesModule,
  ],
})
export class AppModule {}
