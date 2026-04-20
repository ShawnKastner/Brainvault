import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssets1776470400000 implements MigrationInterface {
  name = 'AddAssets1776470400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(32) NOT NULL DEFAULT 'image',
        "filename" character varying(120) NOT NULL,
        "originalName" character varying(255) NOT NULL,
        "contentType" character varying(80) NOT NULL,
        "size" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_assets_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_assets_filename"
      ON "assets" ("filename")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_assets_type"
      ON "assets" ("type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assets_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assets_filename"');
    await queryRunner.query('DROP TABLE IF EXISTS "assets"');
  }
}
