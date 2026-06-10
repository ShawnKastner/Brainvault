import { QueryRunner } from 'typeorm';
import { AddAssetPreviews1781053200000 } from './1781053200000-AddAssetPreviews';

describe(AddAssetPreviews1781053200000.name, () => {
  it('adds preview metadata and initializes existing asset statuses', async () => {
    const query = jest.fn();
    const migration = new AddAssetPreviews1781053200000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('"previewStatus" character varying(24)');
    expect(sql).toContain(`WHEN "contentType" = 'application/pdf' THEN 'ready'`);
    expect(sql).toContain(`WHEN "type" IN ('file', 'pdf') THEN 'pending'`);
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_assets_preview_status"');
  });
});
