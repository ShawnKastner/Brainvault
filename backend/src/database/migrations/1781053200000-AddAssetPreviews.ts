import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetPreviews1781053200000 implements MigrationInterface {
  name = 'AddAssetPreviews1781053200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assets"
      ADD COLUMN IF NOT EXISTS "previewStatus" character varying(24) NOT NULL DEFAULT 'not_required',
      ADD COLUMN IF NOT EXISTS "previewSize" integer,
      ADD COLUMN IF NOT EXISTS "previewErrorCode" character varying(64),
      ADD COLUMN IF NOT EXISTS "previewGeneratorVersion" character varying(64),
      ADD COLUMN IF NOT EXISTS "previewUpdatedAt" TIMESTAMP
    `);

    await queryRunner.query(`
      UPDATE "assets"
      SET
        "previewStatus" = CASE
          WHEN "contentType" = 'application/pdf' THEN 'ready'
          WHEN "type" IN ('file', 'pdf') THEN 'pending'
          ELSE 'not_required'
        END,
        "previewSize" = CASE WHEN "contentType" = 'application/pdf' THEN "size" ELSE NULL END,
        "previewUpdatedAt" = CASE WHEN "contentType" = 'application/pdf' THEN now() ELSE NULL END
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_assets_preview_status"
      ON "assets" ("previewStatus")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_assets_preview_status"');
    await queryRunner.query(`
      ALTER TABLE "assets"
      DROP COLUMN IF EXISTS "previewUpdatedAt",
      DROP COLUMN IF EXISTS "previewGeneratorVersion",
      DROP COLUMN IF EXISTS "previewErrorCode",
      DROP COLUMN IF EXISTS "previewSize",
      DROP COLUMN IF EXISTS "previewStatus"
    `);
  }
}
