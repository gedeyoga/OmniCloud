# 🗺️ Blueprint Infrastruktur & Arsitektur Sistem: OmniCloud (Node.js + Vue.js)

Blueprint ini dirancang khusus sebagai panduan arsitektur tingkat tinggi dan spesifikasi teknis cetak biru untuk diumpankan ke model AI Frontier. Dokumen ini fokus **100% pada struktur, logika, alur data, dan mekanisme sistem** tanpa potongan kode, guna memberikan konteks yang absolut dan presisi bagi AI untuk men-generasi keseluruhan sistem dari nol.

---

## 🏗️ 1. Topologi Arsitektur Sistem

OmniCloud beroperasi dengan prinsip **Stateless Passthrough Proxy** dengan **Local Metadata Mirroring**. Server backend bertindak sebagai *traffic controller* dan pipa data tanpa membebani penyimpanan lokal server.

```text
                                 [ LURUS UTAMA: TRAFIK DATA ]
 [ VUE.JS FRONTEND ] ────────────────────────────────────────────────────────┐
   │         │ (Kontrol & Notifikasi)                                        │
   │         ▼                                                               │
   │    [ NODE.JS SERVER ] ──(Koneksi Sinkronisasi)──► [ DATABASE (SQLITE) ]  │
   │         │                                           │ (Metadata)        │
   │         ▼                                           ▼                   │
   └─► [ STREAM PASS-THROUGH PROXY ] ◄───────────────────────────────────────┘
             │
             ├──► [ API Google Drive ] ──► Akun GDrive 1, 2, 3...
             ├──► [ API OneDrive ]     ──► Akun OneDrive 1, 2...
             └──► [ API S3 / Lainnya ] ──► Storage Bucket

```

### 1.1 Siklus Aliran Data Unggahan (Upload Pipeline)

1. **Inisiasi & Alokasi:** Frontend mengirimkan metadata berkas (nama, ukuran total) ke backend. Backend memeriksa database untuk menentukan akun target yang paling optimal, lalu mengembalikan `Upload_ID` dan token sesi.
2. **Koneksi WebSocket:** Frontend membuka koneksi WebSocket khusus menggunakan `Upload_ID` untuk mendengarkan metrik progres penulisan.
3. **Pumping Stream (Multiplexing):** Frontend mengirim berkas menggunakan *multipart/form-data* HTTP POST. Node.js menerima potongan data (*chunks*) di memori menggunakan *Stream Buffer*, mengkalkulasi ukuran yang masuk untuk dikirim ke WebSocket, dan secara instan melakukan `.pipe()` ke HTTP Request API Cloud Provider target.
4. **Finalisasi:** Setelah Cloud Provider mengirimkan respons sukses, backend menulis entri baru ke tabel metadata lokal, lalu mengirim status `100% Complete` ke frontend melalui WebSocket.

---

## 🗄️ 2. Blueprint Skema Database & Relasi (Data Modeling)

Database berfungsi sebagai cermin (*mirror*) dari semua struktur direktori di semua akun cloud. Skema ini dirancang untuk mendukung penggabungan jalur (*path pooling*) sehingga pengguna melihat satu struktur folder terpadu.

### 2.1 Entitas: `CloudAccount` (Manajemen Akun Terintegrasi)

* **`id`** (UUID, Primary Key): Pengidentifikasi unik internal OmniCloud.
* **`email`** (String, Unique): Alamat email akun yang dihubungkan.
* **`provider`** (String/Enum): Jenis provider (`google_drive`, `onedrive`, `s3`, `dropbox`).
* **`encrypted_credentials`** (Text/Blob): String JSON berisi *Refresh Token* dan *Client Configuration* yang dienkripsi menggunakan algoritma **AES-256-GCM** dengan *salt* berbasis sistem env eksternal.
* **`total_space`** (BigInt): Kapasitas penyimpanan total dalam satuan Bytes.
* **`used_space`** (BigInt): Kapasitas penyimpanan terpakai dalam satuan Bytes.
* **`status`** (Boolean/Enum): Status keaktifan akun (`active`, `suspended`, `invalid_token`).

### 2.2 Entitas: `FileMetadata` (Virtual File System Layer)

* **`id`** (UUID, Primary Key): Pengidentifikasi unik berkas di sistem OmniCloud.
* **`virtual_path`** (String, Indexed): Jalur folder virtual di dalam aplikasi (contoh: `/Kerja/Desain/`).
* **`file_name`** (String): Nama berkas atau folder yang ditampilkan ke pengguna.
* **`is_folder`** (Boolean): Identifikasi jenis entri (True jika folder, False jika berkas).
* **`size`** (BigInt): Ukuran berkas dalam Bytes (bernilai `0` jika `is_folder` adalah True).
* **`mime_type`** (String, Nullable): Tipe konten berkas untuk kebutuhan visualisasi ikon di frontend.
* **`cloud_account_id`** (UUID, Foreign Key): Menghubungkan berkas ke pemiliknya di tabel `CloudAccount` (On Delete Cascade).
* **`remote_file_id`** (String, Indexed): ID atau Path asli unik berkas tersebut di sistem API Cloud asli (misal: ID string panjang milik Google Drive atau jalur absolut OneDrive).
* **`remote_parent_id`** (String, Nullable): ID folder induk asli di sisi Cloud Provider guna mempermudah operasi penulisan ulang.

---

## 🛠️ 3. Arsitektur Komponen Backend (Node.js Engine)

Sisi server dibagi menjadi komponen terisolasi (*decoupled modules*) untuk mempermudah AI Frontier melakukan ekspansi jenis provider cloud baru tanpa merusak kode utama.

### 3.1 Lapisan Abstraksi: Multi-Cloud Adapter Engine

Setiap provider wajib diimplementasikan dalam sebuah kelas yang mengekstensi sebuah *Interface Driver* standar. Sifat driver ini adalah menerima *Stream* masukan dan mengembalikan *Stream* keluaran.

* **`Fetch Structure Manager`:** Mengambil daftar struktur pohon folder dari API eksternal dan menormalisasinya menjadi format standar OmniCloud.
* **`Chunked Stream Uploader`:** Driver internal yang mendeteksi ukuran berkas. Jika ukuran berkas melebihi batas reguler provider (misal >5MB), driver otomatis beralih menggunakan metode *Resumable Session Upload* / *Multipart Chunk Upload* milik API target secara transparan.
* **`Stream Downloader Proxy`:** Membuka koneksi `GET` ke API Cloud dan langsung menyalurkan *data buffer stream* kembali ke respons HTTP internal client, sehingga client bisa mengunduh dengan kecepatan maksimal tanpa server menampung berkas di memori.

### 3.2 Lapisan Logika: Smart Space Allocator

Algoritma yang menentukan distribusi penempatan berkas baru berdasarkan kondisi penyimpanan secara *real-time*:

* **Strategi Kuota Terlapang (Max Free Space):** Mencari akun dengan nilai sisa kapasitas (`total_space - used_space`) terbesar.
* **Mekanisme Failover Kontinu:** Jika saat proses *streaming* terjadi kegagalan kuota penuh mendadak di tengah jalan dari sisi provider (karena pembatasan sepihak dari cloud), allocator akan membatalkan sesi, memperbarui status kuota di DB lokal, dan mengalihkan penulisan ulang ke akun terbaik berikutnya.

### 3.3 Lapisan Sinkronisasi: Background Workers & Polling Engine

Sistem penjadwalan (*Cron Job* internal) yang bertugas menjaga akurasi data lokal dengan cloud:

* **Delta Sync Interval:** Setiap $X$ menit, server melakukan *polling* ringan ke API Cloud (menggunakan token `changes.list` atau sejenisnya) untuk memeriksa apakah ada berkas yang dimodifikasi oleh pengguna di luar sistem OmniCloud.
* **Cache Invalidation:** Jika ditemukan perbedaan, tabel `FileMetadata` akan diperbarui secara parsial untuk meminimalkan beban I/O database.

---

## 💻 4. Arsitektur Komponen Frontend (Vue.js Engine)

Komponen frontend dirancang untuk efisiensi render tingkat tinggi (*Virtual Scrolling*) karena berpotensi menampilkan ribuan berkas dalam satu folder terpadu.

### 4.1 State Management System (Pinia Architecture)

* **`File Tree Store`:** Menyimpan status folder aktif saat ini (`current_path`), data berkas yang sedang di-render, riwayat navigasi (*breadcrumbs*), dan fungsi pencarian teks instan dalam memori.
* **`Upload Queue Store`:** Mengelola antrean unggahan multiberkas. Setiap berkas di dalam antrean memiliki objek reaktifnya sendiri yang mencakup: `id`, `name`, `size`, `progress_percentage`, `status` (`pending`, `uploading`, `completed`, `failed`), dan referensi koneksi WebSocket-nya.
* **`Account Management Store`:** Menyimpan daftar integrasi akun yang aktif untuk ditampilkan di halaman pengaturan kuota visual.

### 4.2 Lapisan Antarmuka Pengguna (UI/UX Layer)

* **`Unified File Explorer Component`:** Menggunakan model *Grid* atau *List View*. Tidak ada pemisahan folder berdasarkan nama akun; semua berkas dari akun yang berbeda dicampur dalam satu direktori virtual jika memiliki `virtual_path` yang sama.
* **`Drag-and-Drop Dropzone Wrapper`:** Komponen pembungkus global yang mendeteksi seretan berkas dari Windows Explorer langsung ke area aplikasi web.
* **`Floating Progress Toast`:** Panel melayang di pojok layar yang menampilkan grafik lingkaran atau batang dari total semua progres unggahan yang sedang berjalan secara kolektif dari data `Upload Queue Store`.

---

## ⚡ 5. Spesifikasi Penanganan Logika Kompleks & Edge Cases

Berikan aturan ketat ini pada AI Frontier saat pembuatan logika inti:

### 5.1 Resolusi Konflik Nama Berkas Virtual (Namespace Merging)

Jika ada berkas dengan nama yang persis sama di folder virtual yang sama tetapi berasal dari dua akun berbeda:

1. Database tetap menyimpan nama asli berkas tersebut pada kolom `file_name`.
2. Di tingkat API Controller (`GET /api/files`), backend menjalankan fungsi filter agregasi.
3. Jika ditemukan nama duplikat, backend menyuntikkan properti virtual bernama `display_name` ke dalam objek JSON respons dengan format: `[Nama_File] ([Nama_Provider] - [Email_Akun]).[Ekstensi]`.
4. Frontend Vue.js akan selalu memprioritaskan render kolom `display_name` jika tersedia.

### 5.2 Strategi Pengamanan Token Kredensial (Security Architecture)

Untuk mencegah kebocoran token akses cloud jika database diretas:

* Enkripsi menggunakan algoritma **AES-256-GCM**.
* Kunci enkripsi (*Secret Key*) dipecah menjadi dua bagian: setengah disimpan di file `.env` server, dan setengah lagi digenerasikan otomatis dari pengidentifikasi hardware mesin server (*Machine ID*).
* Setiap kali melakukan pemanggilan API Cloud, backend melakukan dekripsi instan di memori, menggunakannya, lalu segera menghapus variabel dekripsi dari memori (*Garbage Collection Garbage Clean*).
