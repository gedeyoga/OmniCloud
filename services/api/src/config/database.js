import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../../omnicloud.db');

const LEGACY_DEMO_EMAILS = [
	'drive.primary@omnicloud.dev',
	'drive.archive@omnicloud.dev',
	'bucket.media@omnicloud.dev',
];

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS cloud_accounts (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    total_space INTEGER NOT NULL,
    used_space INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'invalid_token')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS file_metadata (
    id TEXT PRIMARY KEY,
    virtual_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    is_folder INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    cloud_account_id TEXT NOT NULL,
    remote_file_id TEXT NOT NULL,
    remote_parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cloud_account_id) REFERENCES cloud_accounts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_file_virtual_path ON file_metadata(virtual_path);
  CREATE INDEX IF NOT EXISTS idx_file_remote_id ON file_metadata(remote_file_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_file_account_remote_id
    ON file_metadata(cloud_account_id, remote_file_id);
`);

const deleteLegacyDemoData = db.transaction(() => {
	const legacyAccounts = db
		.prepare(`
      SELECT id
      FROM cloud_accounts
      WHERE email IN (${LEGACY_DEMO_EMAILS.map(() => '?').join(', ')})
    `)
		.all(...LEGACY_DEMO_EMAILS);

	if (!legacyAccounts.length) {
		return;
	}

	const deleteFiles = db.prepare('DELETE FROM file_metadata WHERE cloud_account_id = ?');
	const deleteAccount = db.prepare('DELETE FROM cloud_accounts WHERE id = ?');

	legacyAccounts.forEach(({ id }) => {
		deleteFiles.run(id);
		deleteAccount.run(id);
	});
});

deleteLegacyDemoData();
