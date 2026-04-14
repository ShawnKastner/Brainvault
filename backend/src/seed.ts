import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Space } from './spaces/space.entity';
import { Page } from './pages/page.entity';

const ds = new DataSource({
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5432),
  database: process.env['DB_NAME'] ?? 'brainvault',
  username: process.env['DB_USER'] ?? 'brainvault',
  password: process.env['DB_PASS'] ?? 'brainvault_secret',
  entities: [Space, Page],
  synchronize: false,
});

async function seed(): Promise<void> {
  await ds.initialize();
  const sRepo = ds.getRepository(Space);
  const pRepo = ds.getRepository(Page);

  const dev = sRepo.create({ name: 'Development', color: '#378ADD', sortOrder: 0 });
  await sRepo.save(dev);
  await pRepo.save([
    pRepo.create({
      title: 'NestJS Architektur', spaceId: dev.id, sortOrder: 0,
      description: 'Bewaehlte Patterns fuer skalierbare NestJS-Backends.',
      contentFormat: 'markdown',
      content: '## Modulstruktur\n\nJedes Feature lebt in einem eigenen Modul. Das Modul importiert nur, was es braucht.\n\n```ts\n@Module({\n  imports: [TypeOrmModule.forFeature([UserEntity])],\n  controllers: [UserController],\n  providers: [UserService],\n})\n```',
      tags: ['nestjs', 'backend', 'typescript'],
    }),
    pRepo.create({
      title: 'Angular 19 Patterns', spaceId: dev.id, sortOrder: 1,
      description: 'Template-Syntax, Signals und neue Control Flow.',
      contentFormat: 'markdown',
      content: '## Neue Template-Syntax\n\nSeit Angular 17 gibt es den neuen Control Flow. `*ngFor` und `*ngIf` sind deprecated.\n\n## Signals\n\nSignals ersetzen langfristig RxJS fuer einfaches State Management.',
      tags: ['angular', 'frontend', 'signals'],
    }),
    pRepo.create({
      title: 'Docker Cheatsheet', spaceId: dev.id, sortOrder: 2,
      description: 'Die wichtigsten Docker-Befehle auf einen Blick.',
      contentFormat: 'markdown',
      content: '## Haeufige Befehle\n\n```bash\ndocker compose up -d --build\ndocker compose logs -f [service]\ndocker exec -it [container] sh\ndocker system prune -af\n```',
      tags: ['docker', 'devops'],
    }),
    pRepo.create({
      title: 'Markdown Notizen', spaceId: dev.id, sortOrder: 3,
      description: 'Beispielseite fuer Markdown-Inhalte.',
      contentFormat: 'markdown',
      content: "## Markdown Grundlagen\n\nMarkdown rendert **fetten Text**, Listen und `Inline-Code`.\n\n- Schnell zu schreiben\n- Gut fuer technische Notizen\n- Wird erst im Frontend gerendert\n\n```ts\nconst format = 'markdown';\n```\n\n> HTML entsteht erst in der Ansicht.",
      tags: ['markdown', 'notes'],
    }),
  ]);

  const devops = sRepo.create({ name: 'DevOps / Infra', color: '#639922', sortOrder: 1 });
  await sRepo.save(devops);
  await pRepo.save([
    pRepo.create({
      title: 'Homeserver Setup', spaceId: devops.id, sortOrder: 0,
      description: 'Dokumentation des Homeserver-Setups.',
      contentFormat: 'markdown',
      content: '## Hardware\n\nMini-PC mit 32 GB RAM, 2 TB NVMe, Ubuntu Server 24.04 LTS.\n\n## Dienste\n\nAlle Services laufen in Docker Compose. Traefik als Reverse Proxy.\n\n> BrainVault, Gitea, Uptime Kuma, Paperless-ngx, Vaultwarden',
      tags: ['homeserver', 'ubuntu', 'selfhosted'],
    }),
  ]);

  console.log('Seed erfolgreich eingespielt!');
  await ds.destroy();
}

seed().catch(console.error);
