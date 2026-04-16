import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1776297600000 implements MigrationInterface {
  name = 'InitialSchema1776297600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "color" character varying NOT NULL DEFAULT '#378ADD',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_dbe542974aca57afcb60709d4c8" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(200) NOT NULL,
        "description" text,
        "content" text,
        "contentFormat" character varying(20) NOT NULL DEFAULT 'html',
        "tags" text array NOT NULL DEFAULT '{}',
        "spaceId" uuid NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_8f21ed625aa34c8391d636b7d3b" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scopeType" character varying(32) NOT NULL,
        "scopeId" character varying(100) NOT NULL,
        "theme" character varying(20) NOT NULL DEFAULT 'classic',
        "compactNavigation" boolean NOT NULL DEFAULT false,
        "showReadingStats" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_4800b266ba790931744b3e53a74" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PK_dbe542974aca57afcb60709d4c8'
            AND conrelid = '"spaces"'::regclass
        ) THEN
          ALTER TABLE "spaces"
          ADD CONSTRAINT "PK_dbe542974aca57afcb60709d4c8"
          PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PK_8f21ed625aa34c8391d636b7d3b'
            AND conrelid = '"pages"'::regclass
        ) THEN
          ALTER TABLE "pages"
          ADD CONSTRAINT "PK_8f21ed625aa34c8391d636b7d3b"
          PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PK_4800b266ba790931744b3e53a74'
            AND conrelid = '"app_settings"'::regclass
        ) THEN
          ALTER TABLE "app_settings"
          ADD CONSTRAINT "PK_4800b266ba790931744b3e53a74"
          PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_c4aef9b23f1222bebc5897de72d'
            AND conrelid = '"pages"'::regclass
        ) THEN
          ALTER TABLE "pages"
          ADD CONSTRAINT "FK_c4aef9b23f1222bebc5897de72d"
          FOREIGN KEY ("spaceId")
          REFERENCES "spaces"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_2d2e5d2ea0e280cb370948888b"
      ON "app_settings" ("scopeType", "scopeId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "pages"');
    await queryRunner.query('DROP TABLE IF EXISTS "app_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "spaces"');
  }
}
