import { QueryRunner } from 'typeorm';
import { AddAssets1776470400000 } from './1776470400000-AddAssets';

describe(AddAssets1776470400000.name, () => {
  it('creates an assets table with filename and type indexes', async () => {
    const query = jest.fn();
    const migration = new AddAssets1776470400000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "assets"');
    expect(sql).toContain('"filename" character varying(120) NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_assets_filename"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_assets_type"');
  });
});
