import { defineStore } from 'pinia';
import { api } from '../services/api';

function normalizePath(path) {
	if (!path || path === '/') return '/';
	const prefixed = path.startsWith('/') ? path : `/${path}`;
	return prefixed.endsWith('/') ? prefixed : `${prefixed}/`;
}

function buildVirtualPath(currentPath, relativePath = '') {
	const normalizedCurrent = normalizePath(currentPath);
	if (!relativePath) return normalizedCurrent;

	const segments = relativePath.split('/').filter(Boolean);
	segments.pop();

	if (!segments.length) return normalizedCurrent;
	return normalizePath(`${normalizedCurrent}${segments.join('/')}`);
}

function normalizeUploadEntry(entry) {
	if (entry instanceof File) {
		return {
			file: entry,
			relativePath: entry.webkitRelativePath || entry.name,
		};
	}

	return {
		file: entry.file,
		relativePath: entry.relativePath || entry.file?.webkitRelativePath || entry.file?.name,
	};
}

export const useUploadQueueStore = defineStore('uploadQueue', {
	state: () => ({
		uploads: [],
	}),
	getters: {
		activeUploads: (state) => state.uploads.filter((item) => item.status !== 'completed'),
		totalProgress: (state) => {
			if (!state.uploads.length) return 0;
			const total = state.uploads.reduce((sum, item) => sum + item.progress_percentage, 0);
			return Math.round(total / state.uploads.length);
		},
	},
	actions: {
		registerUpload(file, currentPath, relativePath) {
			const upload = {
				id: crypto.randomUUID(),
				file,
				name: relativePath || file.name,
				size: file.size,
				progress_percentage: 0,
				status: 'pending',
				socket: null,
				currentPath,
				error: null,
			};

			this.uploads.unshift(upload);
			return upload;
		},
		updateUpload(id, patch) {
			const index = this.uploads.findIndex((item) => item.id === id);
			if (index === -1) return;
			this.uploads[index] = { ...this.uploads[index], ...patch };
		},
		async uploadFiles(files, currentPath, onCompleted) {
			for (const rawEntry of files) {
				const { file, relativePath } = normalizeUploadEntry(rawEntry);
				const queueItem = this.registerUpload(file, currentPath, relativePath);
				const targetPath = buildVirtualPath(currentPath, relativePath);

				try {
					const { data } = await api.initiateUpload({
						file_name: file.name,
						size: file.size,
						mime_type: file.type || 'application/octet-stream',
						virtual_path: targetPath,
					});

					const socket = api.createUploadSocket(data.upload_id);
					this.updateUpload(queueItem.id, {
						status: 'uploading',
						socket,
						remoteUploadId: data.upload_id,
					});

					socket.onmessage = (event) => {
						const message = JSON.parse(event.data);
						if (message.type === 'upload:progress') {
							this.updateUpload(queueItem.id, {
								progress_percentage: message.percent,
								status: message.status,
							});
						}

						if (message.type === 'upload:complete') {
							this.updateUpload(queueItem.id, {
								progress_percentage: 100,
								status: 'completed',
							});
							socket.close();
							onCompleted?.();
						}

						if (message.type === 'upload:error') {
							this.updateUpload(queueItem.id, {
								status: 'failed',
								error: message.message,
							});
							socket.close();
						}
					};

					socket.onerror = () => {
						this.updateUpload(queueItem.id, {
							status: 'failed',
							error: 'WebSocket connection failed',
						});
					};

					await api.uploadFile(data.upload_id, file);
				} catch (error) {
					this.updateUpload(queueItem.id, {
						status: 'failed',
						error: error.message,
					});
				}
			}
		},
	},
});
