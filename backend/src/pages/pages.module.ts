import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsModule } from '../assets/assets.module';
import { GotenbergClientService } from '../assets/preview/gotenberg-client.service';
import { Space } from '../spaces/entities/space.entity';
import { Page } from './entities/page.entity';
import { PagesPdfExportService } from './pages-pdf-export.service';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Space]), AssetsModule],
  providers: [PagesService, PagesPdfExportService, GotenbergClientService],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
