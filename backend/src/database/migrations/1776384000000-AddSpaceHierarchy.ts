import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpaceHierarchy1776384000000 implements MigrationInterface {
  name = 'AddSpaceHierarchy1776384000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spaces"
      ADD COLUMN IF NOT EXISTS "parentId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_spaces_parentId"
      ON "spaces" ("parentId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_spaces_parentId_spaces_id'
            AND conrelid = '"spaces"'::regclass
        ) THEN
          ALTER TABLE "spaces"
          ADD CONSTRAINT "FK_spaces_parentId_spaces_id"
          FOREIGN KEY ("parentId")
          REFERENCES "spaces"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "spaces"
      DROP CONSTRAINT IF EXISTS "FK_spaces_parentId_spaces_id"
    `);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_spaces_parentId"');
    await queryRunner.query('ALTER TABLE "spaces" DROP COLUMN IF EXISTS "parentId"');
  }
}
