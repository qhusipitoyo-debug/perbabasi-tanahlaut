/**
 * Database: SQLite via node:sqlite (built-in, tanpa dependency).
 * Menangani schema, migrasi sederhana dan seed data awal (opsional via SEED_DEMO).
 */
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { hashPassword } from './auth.js';

export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      full_name     TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','bendahara')),
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS kas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
      type            TEXT NOT NULL DEFAULT 'tunai' CHECK (type IN ('tunai','bank','ewallet','lainnya')),
      opening_balance INTEGER NOT NULL DEFAULT 0,
      note            TEXT DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      type  TEXT NOT NULL CHECK (type IN ('masuk','keluar')),
      UNIQUE (name, type)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kas_id      INTEGER NOT NULL REFERENCES kas(id) ON DELETE RESTRICT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      type        TEXT NOT NULL CHECK (type IN ('masuk','keluar')),
      amount      INTEGER NOT NULL CHECK (amount > 0),
      date        TEXT NOT NULL,
      ref_no      TEXT DEFAULT '',
      note        TEXT DEFAULT '',
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_trx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_trx_kas ON transactions(kas_id);
    CREATE INDEX IF NOT EXISTS idx_trx_type ON transactions(type);

    CREATE TABLE IF NOT EXISTS members (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      member_no  TEXT UNIQUE,
      name       TEXT NOT NULL,
      position   TEXT DEFAULT '',       -- posisi / jabatan
      team       TEXT DEFAULT '',       -- tim / kelompok
      phone      TEXT DEFAULT '',
      active     INTEGER NOT NULL DEFAULT 1,
      joined_at  TEXT NOT NULL DEFAULT (date('now','localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS member_dues (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      period      TEXT NOT NULL,        -- format YYYY-MM
      amount      INTEGER NOT NULL CHECK (amount > 0),
      paid_date   TEXT NOT NULL,
      note        TEXT DEFAULT '',
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (member_id, period)
    );
    CREATE INDEX IF NOT EXISTS idx_dues_period ON member_dues(period);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      detail     TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    CREATE TABLE IF NOT EXISTS surat_bidang (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      code       TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS surat (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      number_seq  INTEGER NOT NULL,
      number_year INTEGER NOT NULL,
      nomor       TEXT NOT NULL UNIQUE,
      tanggal     TEXT NOT NULL,
      perihal     TEXT NOT NULL,
      tujuan      TEXT NOT NULL,
      bidang_id   INTEGER REFERENCES surat_bidang(id) ON DELETE SET NULL,
      lampiran    TEXT DEFAULT '',
      sifat       TEXT NOT NULL DEFAULT 'BIASA' CHECK (sifat IN ('BIASA','PENTING','SEGERA','RAHASIA')),
      keterangan  TEXT DEFAULT '',
      isi         TEXT DEFAULT '',
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (number_year, number_seq)
    );
    CREATE INDEX IF NOT EXISTS idx_surat_tanggal ON surat(tanggal);
    CREATE INDEX IF NOT EXISTS idx_surat_bidang ON surat(bidang_id);
  `);
}

function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
  );
  insertUser.run('admin', hashPassword('admin123'), 'Administrator', 'admin');
  insertUser.run('bendahara', hashPassword('bendahara123'), 'Bendahara Perbasasi', 'bendahara');

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('org_name', 'PERBASI Tanah Laut');
  insertSetting.run('org_tagline', 'Perserikatan Baseball Softball Seluruh Indonesia — Pengurus Kabupaten Tanah Laut');
  insertSetting.run('org_address', 'Jl. A. Yani, Pelaihari, Kabupaten Tanah Laut, Kalimantan Selatan');
  insertSetting.run('org_phone', '(0512) 000000');
  insertSetting.run('org_email', 'perbasitanlaut@example.com');
  insertSetting.run('iuran_default', '50000');
  insertSetting.run('surat_kode', '400.4.1');
  insertSetting.run('surat_org', 'PERBASASI-TALA');
  insertSetting.run('surat_ketua', 'Ketua Perbasasi Tanah Laut');

  // Kategori bawaan
  const insertCat = db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
  const catsMasuk = ['Iuran Anggota', 'Donasi & Sponsor', 'Pemasukan Turnamen', 'Penjualan', 'Bunga Bank', 'Lain-lain'];
  const catsKeluar = ['Operasional Kantor', 'Konsumsi', 'Transportasi & Perlengkapan', 'Hadiah & Trophy', 'Honor Pelatih & Wasit', 'Pemeliharaan', 'Lain-lain'];
  for (const c of catsMasuk) insertCat.run(c, 'masuk');
  for (const c of catsKeluar) insertCat.run(c, 'keluar');

  // Kas bawaan
  const insertKas = db.prepare('INSERT INTO kas (name, type, opening_balance, note) VALUES (?, ?, ?, ?)');
  insertKas.run('Kas Tunai Sekretariat', 'tunai', 6000000, 'Kas utama di sekretariat');
  insertKas.run('Bank BRI Perbasasi', 'bank', 5000000, 'Rekening resmi organisasi');

  if (!config.seedDemo) return;

  // ---- Data contoh agar dashboard langsung hidup (aman dihapus lewat UI) ----
  const kasRows = db.prepare('SELECT id FROM kas ORDER BY id').all();
  const kasTunai = kasRows[0].id;
  const kasBank = kasRows[1].id;
  const catId = (name, type) => db.prepare('SELECT id FROM categories WHERE name = ? AND type = ?').get(name, type)?.id;

  const adminId = db.prepare("SELECT id FROM users WHERE username = 'admin'").get().id;
  const insertTrx = db.prepare(
    'INSERT INTO transactions (kas_id, category_id, type, amount, date, ref_no, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // Generate ~6 bulan transaksi contoh secara deterministik (tanpa tanggal masa depan)
  const now = new Date();
  const todayDay = now.getDate();
  const clampDay = (day, monthDate) => {
    const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
    return Math.min(day, isCurrentMonth ? todayDay : 28);
  };
  const demo = [];
  let ref = 1;
  for (let back = 5; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const day = (dayNum) => String(clampDay(dayNum, d)).padStart(2, '0');
    demo.push([kasBank, catId('Iuran Anggota', 'masuk'), 'masuk', 750000 + back * 50000, `${ym}-${day(5)}`, `IU-${ref++}`, 'Setoran iuran anggota bulanan', adminId]);
    demo.push([kasBank, catId('Donasi & Sponsor', 'masuk'), 'masuk', back % 2 ? 0 : 1500000, `${ym}-${day(12)}`, `SP-${ref++}`, 'Sponsorship turnamen antar klub', adminId]);
    demo.push([kasTunai, catId('Konsumsi', 'keluar'), 'keluar', 320000 + back * 25000, `${ym}-${day(8)}`, `KS-${ref++}`, 'Konsumsi latihan & rapat', adminId]);
    demo.push([kasBank, catId('Honor Pelatih & Wasit', 'keluar'), 'keluar', 1000000, `${ym}-${day(10)}`, `HN-${ref++}`, 'Honor pelatih bulan berjalan', adminId]);
    demo.push([kasTunai, catId('Operasional Kantor', 'keluar'), 'keluar', 150000 + back * 10000, `${ym}-${day(9)}`, `OP-${ref++}`, 'ATK & operasional sekretariat', adminId]);
    if (back % 2 === 0) demo.push([kasBank, catId('Pemasukan Turnamen', 'masuk'), 'masuk', 2500000, `${ym}-${day(11)}`, `TR-${ref++}`, 'Pendaftaran turnamen tahunan', adminId]);
    else demo.push([kasBank, catId('Transportasi & Perlengkapan', 'keluar'), 'keluar', 450000, `${ym}-${day(10)}`, `TP-${ref++}`, 'Bola, bat & glove latihan', adminId]);
  }
  for (const row of demo) {
    if (row[3] > 0) insertTrx.run(...row);
  }

  // Contoh anggota + iuran bulan berjalan
  const insertMember = db.prepare('INSERT INTO members (member_no, name, position, team, phone) VALUES (?, ?, ?, ?, ?)');
  const demoMembers = [
    ['PB-001', 'Andi Riyadi', 'Kapten / Guard', 'Tim Putra Elite', '081255500001'],
    ['PB-002', 'Dewi Lestari', 'Center', 'Tim Putri', '081255500002'],
    ['PB-003', 'Rizky Saputra', 'Forward', 'Tim Putra Elite', '081255500003'],
    ['PB-004', 'Sari Wulandari', 'Coach', 'Pelatih Tim Putri', '081255500004'],
    ['PB-005', 'Bagas Prakoso', 'Guard', 'Tim Junior', '081255500005'],
    ['PB-006', 'Nadia Puspita', 'Sekretaris', 'Pengurus', '081255500006'],
  ];
  for (const m of demoMembers) insertMember.run(...m);

  const thisPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const insertDue = db.prepare('INSERT INTO member_dues (member_id, period, amount, paid_date, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?)');
  const memberRows = db.prepare('SELECT id FROM members ORDER BY id').all();
  const today = now.toISOString().slice(0, 10);
  for (const [i, m] of memberRows.entries()) {
    if (i % 3 !== 2) insertDue.run(m.id, thisPeriod, 50000, today, 'Iuran bulan berjalan', adminId); // 4 dari 6 lunas
  }
}

/** Seed bidang surat untuk semua instalasi (baru maupun lama) — hanya bila tabel kosong */
function seedSuratIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM surat_bidang').get().n;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO surat_bidang (name, code, sort_order) VALUES (?, ?, ?)');
    const bidangs = [
      ['Bidang Olahraga', 'OR', 1],
      ['Bidang Kepelatihan', 'KP', 2],
      ['Bidang Wasit & Pertandingan', 'WP', 3],
      ['Bidang Pembinaan & Usia Dini', 'PB', 4],
      ['Administrasi & Kesekretariatan', 'ADM', 5],
    ];
    for (const b of bidangs) insert.run(...b);
  }
  const upsert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  upsert.run('surat_kode', '400.4.1');
  upsert.run('surat_org', 'PERBASASI-TALA');
  upsert.run('surat_ketua', 'Ketua Perbasasi Tanah Laut');
}

export function initDb() {
  migrate();
  seedIfEmpty();
  seedSuratIfEmpty();
}

/** Ringkasan saldo per kas (opening balance + mutasi) */
export function kasBalances() {
  return db
    .prepare(
      `SELECT k.id, k.name, k.type, k.opening_balance,
              COALESCE(SUM(CASE WHEN t.type = 'masuk'  THEN t.amount END), 0) AS total_masuk,
              COALESCE(SUM(CASE WHEN t.type = 'keluar' THEN t.amount END), 0) AS total_keluar,
              k.opening_balance
                + COALESCE(SUM(CASE WHEN t.type = 'masuk'  THEN t.amount END), 0)
                - COALESCE(SUM(CASE WHEN t.type = 'keluar' THEN t.amount END), 0) AS balance
         FROM kas k
         LEFT JOIN transactions t ON t.kas_id = k.id
        GROUP BY k.id
        ORDER BY k.id`
    )
    .all();
}
