import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, Repository } from 'typeorm';
import { resolveDbSynchronize } from './config/env.validation';
import { Page, PageContentFormat } from './pages/entities/page.entity';
import { AppSetting } from './settings/entities/app-setting.entity';
import { Space } from './spaces/entities/space.entity';

loadEnv();

const nodeEnv = process.env['NODE_ENV'] ?? 'development';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  database: process.env['DB_NAME'] ?? 'brainvault',
  username: process.env['DB_USER'] ?? 'brainvault',
  password: process.env['DB_PASS'] ?? 'brainvault_secret',
  entities: [Space, Page, AppSetting],
  synchronize: resolveDbSynchronize(nodeEnv, process.env['DB_SYNCHRONIZE']),
});

interface SeedSpace {
  name: string;
  description?: string;
  color: string;
  sortOrder: number;
  pages: SeedPage[];
}

interface SeedPage {
  title: string;
  description: string;
  content: string;
  contentFormat: PageContentFormat;
  tags: string[];
  sortOrder: number;
}

const seedSpaces: SeedSpace[] = [
  {
    name: 'Development',
    color: '#378ADD',
    sortOrder: 0,
    pages: [
      {
        title: 'NestJS Architektur',
        sortOrder: 0,
        description: 'Bewaehlte Patterns fuer skalierbare NestJS-Backends.',
        contentFormat: 'markdown',
        content:
          '## Modulstruktur\n\nJedes Feature lebt in einem eigenen Modul. Das Modul importiert nur, was es braucht.\n\n```ts\n@Module({\n  imports: [TypeOrmModule.forFeature([UserEntity])],\n  controllers: [UserController],\n  providers: [UserService],\n})\n```',
        tags: ['nestjs', 'backend', 'typescript'],
      },
      {
        title: 'Angular 21 Patterns',
        sortOrder: 1,
        description: 'Template-Syntax, Signals und neue Control Flow.',
        contentFormat: 'markdown',
        content:
          '## Neue Template-Syntax\n\nSeit Angular 17 gibt es den neuen Control Flow. `*ngFor` und `*ngIf` sind deprecated.\n\n## Signals\n\nSignals ersetzen langfristig RxJS fuer einfaches State Management.',
        tags: ['angular', 'frontend', 'signals'],
      },
      {
        title: 'Docker Cheatsheet',
        sortOrder: 2,
        description: 'Die wichtigsten Docker-Befehle auf einen Blick.',
        contentFormat: 'markdown',
        content:
          '## Haeufige Befehle\n\n```bash\ndocker compose up -d --build\ndocker compose logs -f [service]\ndocker exec -it [container] sh\ndocker system prune -af\n```',
        tags: ['docker', 'devops'],
      },
      {
        title: 'Markdown Notizen',
        sortOrder: 3,
        description: 'Beispielseite fuer Markdown-Inhalte.',
        contentFormat: 'markdown',
        content:
          "## Markdown Grundlagen\n\nMarkdown rendert **fetten Text**, Listen und `Inline-Code`.\n\n- Schnell zu schreiben\n- Gut fuer technische Notizen\n- Wird erst im Frontend gerendert\n\n```ts\nconst format = 'markdown';\n```\n\n> HTML entsteht erst in der Ansicht.",
        tags: ['markdown', 'notes'],
      },
    ],
  },
  {
    name: 'DevOps / Infra',
    color: '#639922',
    sortOrder: 1,
    pages: [
      {
        title: 'Homeserver Setup',
        sortOrder: 0,
        description: 'Dokumentation des Homeserver-Setups.',
        contentFormat: 'markdown',
        content:
          '## Hardware\n\nMini-PC mit 32 GB RAM, 2 TB NVMe, Ubuntu Server 24.04 LTS.\n\n## Dienste\n\nAlle Services laufen in Docker Compose. Traefik als Reverse Proxy.\n\n> BrainVault, Gitea, Uptime Kuma, Paperless-ngx, Vaultwarden',
        tags: ['homeserver', 'ubuntu', 'selfhosted'],
      },
    ],
  },
];

async function upsertSpace(spacesRepo: Repository<Space>, seedSpace: SeedSpace): Promise<Space> {
  const space = await spacesRepo.findOne({ where: { name: seedSpace.name } });
  const entity = spacesRepo.create({
    ...space,
    name: seedSpace.name,
    description: seedSpace.description ?? null,
    color: seedSpace.color,
    sortOrder: seedSpace.sortOrder,
  });

  return spacesRepo.save(entity);
}

async function upsertPage(
  pagesRepo: Repository<Page>,
  space: Space,
  seedPage: SeedPage,
): Promise<Page> {
  const page = await pagesRepo.findOne({
    where: {
      title: seedPage.title,
      spaceId: space.id,
    },
  });
  const entity = pagesRepo.create({
    ...page,
    ...seedPage,
    spaceId: space.id,
  });

  return pagesRepo.save(entity);
}

async function seed(): Promise<void> {
  await dataSource.initialize();

  const spacesRepo = dataSource.getRepository(Space);
  const pagesRepo = dataSource.getRepository(Page);

  for (const seedSpace of seedSpaces) {
    const space = await upsertSpace(spacesRepo, seedSpace);
    for (const seedPage of seedSpace.pages) {
      await upsertPage(pagesRepo, space, seedPage);
    }
  }

  console.log('Seed erfolgreich eingespielt.');
  await dataSource.destroy();
}

seed().catch(async (error: unknown) => {
  console.error(error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exitCode = 1;
});
