import { Router } from 'express';
import { listFilesByPath, getFileById } from '../services/fileService.js';
import { getAccountById } from '../services/accountService.js';
import { createAdapter } from '../services/adapterRegistry.js';
import { selectBestAccount } from '../services/spaceAllocator.js';
import { syncAccount } from '../services/syncService.js';

const router = Router();

function getFileContext(fileId) {
	const file = getFileById(fileId);
	if (!file) {
		return { file: null, account: null, adapter: null };
	}

	const account = getAccountById(file.cloud_account_id);
	if (!account) {
		return { file, account: null, adapter: null };
	}

	return {
		file,
		account,
		adapter: createAdapter(account),
	};
}

router.get('/files', (req, res) => {
	const files = listFilesByPath(req.query.path || '/');
	res.json({ data: files });
});

router.get('/files/:id', async (req, res, next) => {
	try {
		const { file, adapter } = getFileContext(req.params.id);
		if (!file) {
			return res.status(404).json({ error: 'File not found' });
		}

		const details = await adapter.getFileDetails(file);
		return res.json({
			data: {
				...file,
				...details,
			},
		});
	} catch (error) {
		next(error);
	}
});

router.get('/files/:id/download', async (req, res, next) => {
	try {
		const { file, adapter } = getFileContext(req.params.id);
		if (!file) {
			return res.status(404).json({ error: 'File not found' });
		}
		const stream = await adapter.getDownloadStream(file);

		res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
		res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
		if (!file.is_folder && file.size) {
			res.setHeader('Content-Length', String(file.size));
		}
		stream.pipe(res);
	} catch (error) {
		next(error);
	}
});

router.patch('/files/:id/rename', async (req, res, next) => {
	try {
		const { name } = req.body;
		if (!name?.trim()) {
			return res.status(400).json({ error: 'New name is required' });
		}

		const { file, account, adapter } = getFileContext(req.params.id);
		if (!file) {
			return res.status(404).json({ error: 'File not found' });
		}

		await adapter.renameFile(file, name.trim());
		await syncAccount(account);

		return res.json({ data: { success: true } });
	} catch (error) {
		next(error);
	}
});

router.delete('/files/:id', async (req, res, next) => {
	try {
		const { file, account, adapter } = getFileContext(req.params.id);
		if (!file) {
			return res.status(404).json({ error: 'File not found' });
		}

		await adapter.deleteFile(file);
		await syncAccount(account);

		return res.json({ data: { success: true } });
	} catch (error) {
		next(error);
	}
});

router.post('/files/folders', async (req, res, next) => {
	try {
		const { name, virtual_path = '/' } = req.body;

		if (!name?.trim()) {
			return res.status(400).json({ error: 'Folder name is required' });
		}

		const { selected } = selectBestAccount(0);
		const account = getAccountById(selected.id);
		const adapter = createAdapter(account);

		await adapter.createFolder({
			name: name.trim(),
			virtualPath: virtual_path,
		});

		await syncAccount(account);

		return res.status(201).json({ data: { success: true } });
	} catch (error) {
		next(error);
	}
});

export default router;
