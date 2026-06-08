import cron from 'node-cron';
import { env } from '../config/env.js';
import { getActiveAccounts, markAccountStatus, updateAccountStorage } from './accountService.js';
import { createAdapter } from './adapterRegistry.js';
import { replaceFilesForAccount } from './fileService.js';

let lastSyncReport = {
	lastRunAt: null,
	scannedAccounts: 0,
	changesDetected: 0,
};

export async function runDeltaSync() {
	const accounts = getActiveAccounts();
	let changesDetected = 0;

	for (const account of accounts) {
		try {
			const adapter = createAdapter(account);
			const remoteFiles = await adapter.fetchStructure();
			const storage = await adapter.getStorageSummary();

			replaceFilesForAccount(account.id, remoteFiles);
			updateAccountStorage(account.id, storage.totalSpace, storage.usedSpace);
			changesDetected += remoteFiles.length;
		} catch (error) {
			markAccountStatus(account.id, 'invalid_token');
			console.error(`Sync failed for account ${account.email}:`, error.message);
		}
	}

	lastSyncReport = {
		lastRunAt: new Date().toISOString(),
		scannedAccounts: accounts.length,
		changesDetected,
	};

	return lastSyncReport;
}

export function scheduleSync() {
	const interval = Math.max(1, env.syncIntervalMinutes);
	cron.schedule(`*/${interval} * * * *`, () => {
		runDeltaSync().catch((error) => {
			console.error('Delta sync failed:', error);
		});
	});
}

export function getLastSyncReport() {
	return lastSyncReport;
}

export async function syncAccount(account) {
	const adapter = createAdapter(account);
	const remoteFiles = await adapter.fetchStructure();
	const storage = await adapter.getStorageSummary();

	replaceFilesForAccount(account.id, remoteFiles);
	updateAccountStorage(account.id, storage.totalSpace, storage.usedSpace);

	return {
		accountId: account.id,
		filesSynced: remoteFiles.length,
		totalSpace: storage.totalSpace,
		usedSpace: storage.usedSpace,
	};
}
