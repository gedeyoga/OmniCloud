# OmniCloud API

Backend Node.js untuk proxy metadata, upload stream, WebSocket progress, dan sinkronisasi delta.

## Endpoint utama
- `GET /api/health`
- `GET /api/accounts`
- `GET /api/files?path=/`
- `POST /api/uploads/initiate`
- `POST /api/uploads/:uploadId/stream`
- `GET /api/files/:id/download`
- `WS /ws/uploads?uploadId=...`
