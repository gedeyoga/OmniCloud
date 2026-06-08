import { GoogleDriveAdapter } from '../adapters/GoogleDriveAdapter.js';
import { OneDriveAdapter } from '../adapters/OneDriveAdapter.js';
import { S3Adapter } from '../adapters/S3Adapter.js';

const adapters = {
	google_drive: GoogleDriveAdapter,
	onedrive: OneDriveAdapter,
	s3: S3Adapter,
};

export function createAdapter(account) {
	const Adapter = adapters[account.provider];

	if (!Adapter) {
		throw new Error(`Unsupported provider: ${account.provider}`);
	}

	return new Adapter(account);
}
