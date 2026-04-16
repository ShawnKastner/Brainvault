import { QueryRunner } from 'typeorm';
import { AddSpaceHierarchy1776384000000 } from './1776384000000-AddSpaceHierarchy';

describe(AddSpaceHierarchy1776384000000.name, () => {
  it('adds nullable parentId with index and cascade foreign key', async () => {
    const query = jest.fn();
    const migration = new AddSpaceHierarchy1776384000000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "parentId" uuid');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_spaces_parentId"');
    expect(sql).toContain('FOREIGN KEY ("parentId")');
    expect(sql).toContain('ON DELETE CASCADE');
  });
});
