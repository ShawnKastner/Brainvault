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
      content: '<h2>Modulstruktur</h2><p>Jedes Feature lebt in einem eigenen Modul. Das Modul importiert nur, was es braucht.</p><pre><code>@Module({\n  imports: [TypeOrmModule.forFeature([UserEntity])],\n  controllers: [UserController],\n  providers: [UserService],\n})</code></pre>',
      tags: ['nestjs', 'backend', 'typescript'],
    }),
    pRepo.create({
      title: 'Angular 19 Patterns', spaceId: dev.id, sortOrder: 1,
      description: 'Template-Syntax, Signals und neue Control Flow.',
      content: '<h2>Neue Template-Syntax</h2><p>Seit Angular 17 gibt es den neuen Control Flow. <code>*ngFor</code> und <code>*ngIf</code> sind deprecated.</p><h2>Signals</h2><p>Signals ersetzen langfristig RxJS fuer einfaches State Management.</p>',
      tags: ['angular', 'frontend', 'signals'],
    }),
    pRepo.create({
      title: 'Docker Cheatsheet', spaceId: dev.id, sortOrder: 2,
      description: 'Die wichtigsten Docker-Befehle auf einen Blick.',
      content: '<h2>Haeufige Befehle</h2><pre><code>docker compose up -d --build\ndocker compose logs -f [service]\ndocker exec -it [container] sh\ndocker system prune -af</code></pre>',
      tags: ['docker', 'devops'],
    }),
  ]);

  const devops = sRepo.create({ name: 'DevOps / Infra', color: '#639922', sortOrder: 1 });
  await sRepo.save(devops);
  await pRepo.save([
    pRepo.create({
      title: 'Homeserver Setup', spaceId: devops.id, sortOrder: 0,
      description: 'Dokumentation des Homeserver-Setups.',
      content: '<h2>Hardware</h2><p>Mini-PC mit 32 GB RAM, 2 TB NVMe, Ubuntu Server 24.04 LTS.</p><h2>Dienste</h2><p>Alle Services laufen in Docker Compose. Traefik als Reverse Proxy.</p><blockquote>BrainVault, Gitea, Uptime Kuma, Paperless-ngx, Vaultwarden</blockquote>',
      tags: ['homeserver', 'ubuntu', 'selfhosted'],
    }),
  ]);

  console.log('Seed erfolgreich eingespielt!');
  await ds.destroy();
}

seed().catch(console.error);
