# OmniCloud

Implementasi penuh blueprint `blueprint.md` dengan arsitektur monorepo sederhana:

- `apps/web`: frontend Vue 3 + Pinia + Vue Router
- `services/api`: backend Node.js + Express + WebSocket + SQLite

## Fitur utama
- Unified file explorer berbasis virtual path
- Smart space allocator berdasarkan free space terbesar
- Upload initiation + stream proxy + WebSocket progress
- Metadata mirroring lokal di SQLite
- Simulasi adapter multi-cloud untuk Google Drive, OneDrive, dan S3
- Delta sync worker terjadwal
- Enkripsi kredensial AES-256-GCM dengan secret gabungan env + machine fingerprint

## Menjalankan proyek
1. Salin `services/api/.env.example` menjadi `services/api/.env` bila perlu.
2. Jalankan mode pengembangan dari root:
   - `npm run dev`
3. Build frontend:
   - `npm run build`
4. Jalankan backend saja:
   - `npm start`

## Endpoint backend
- `GET /api/health`
- `GET /api/accounts`
- `GET /api/files?path=/`
- `POST /api/uploads/initiate`
- `POST /api/uploads/:uploadId/stream`
- `GET /api/files/:id/download`
- `WS /ws/uploads?uploadId=...`
