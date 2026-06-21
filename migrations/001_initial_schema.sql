-- ============================================================================
-- DPRD Kota Semarang & Pemerintahan Indonesia — Chatbot Database Schema
-- ============================================================================
-- Versi  : 1.0.0
-- Dibuat : 2026-06-21
-- Engine : PostgreSQL 15+
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- untuk gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 2. CUSTOM TYPES
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'model');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. HELPER FUNCTION — auto-update kolom updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. TABEL: topics
--    Kategori topik percakapan yang didukung (untuk analitik & filtering)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(60)  NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    icon            VARCHAR(10)  DEFAULT '📋',
    display_order   SMALLINT     DEFAULT 0,
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  topics            IS 'Kategori topik yang didukung oleh chatbot';
COMMENT ON COLUMN topics.slug       IS 'Slug unik untuk identifikasi topik (URL-friendly)';
COMMENT ON COLUMN topics.icon       IS 'Emoji ikon representasi topik';

-- ---------------------------------------------------------------------------
-- 5. TABEL: sessions
--    Setiap percakapan terisolasi dalam satu sesi
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255) DEFAULT 'Percakapan Baru',
    client_id       VARCHAR(120),
    topic_id        UUID         REFERENCES topics(id) ON DELETE SET NULL,
    is_active       BOOLEAN      DEFAULT TRUE,
    message_count   INTEGER      DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  sessions                IS 'Sesi percakapan chatbot';
COMMENT ON COLUMN sessions.client_id      IS 'Identifier opsional dari klien/pengguna';
COMMENT ON COLUMN sessions.message_count  IS 'Jumlah pesan dalam sesi (di-update via trigger)';
COMMENT ON COLUMN sessions.last_message_at IS 'Waktu pesan terakhir dikirim';

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. TABEL: messages
--    Setiap pesan (user maupun model) disimpan berurutan
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role            message_role NOT NULL,
    content         TEXT         NOT NULL,
    token_count     INTEGER,
    sequence_number INTEGER      NOT NULL,
    processing_ms   INTEGER,
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  messages                  IS 'Pesan individual dalam sesi percakapan';
COMMENT ON COLUMN messages.role             IS 'Peran pengirim: user atau model';
COMMENT ON COLUMN messages.sequence_number  IS 'Urutan pesan dalam sesi (1-indexed)';
COMMENT ON COLUMN messages.processing_ms    IS 'Waktu pemrosesan AI dalam milidetik';
COMMENT ON COLUMN messages.token_count      IS 'Estimasi jumlah token pada pesan';

-- ---------------------------------------------------------------------------
-- 7. TABEL: feedback
--    Rating dan komentar pengguna terhadap jawaban AI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID         NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id      UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    rating          SMALLINT     NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),

    CONSTRAINT uq_feedback_message UNIQUE (message_id)
);

COMMENT ON TABLE  feedback          IS 'Umpan balik pengguna terhadap respons AI';
COMMENT ON COLUMN feedback.rating   IS 'Skor 1-5 bintang';

-- ---------------------------------------------------------------------------
-- 8. TRIGGER: auto-update message_count & last_message_at pada sessions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_session_message_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sessions
        SET message_count  = message_count + 1,
            last_message_at = NEW.created_at
        WHERE id = NEW.session_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sessions
        SET message_count = GREATEST(message_count - 1, 0)
        WHERE id = OLD.session_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_sync_stats
    AFTER INSERT OR DELETE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_session_message_stats();

-- ---------------------------------------------------------------------------
-- 9. INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_client_id       ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at      ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active       ON sessions(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_session_id      ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_seq     ON messages(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_session_id      ON feedback(session_id);

-- ---------------------------------------------------------------------------
-- 10. SEED DATA — Topik yang Didukung
-- ---------------------------------------------------------------------------
INSERT INTO topics (slug, name, description, icon, display_order) VALUES
    ('dprd',              'DPRD',                        'Dewan Perwakilan Rakyat Daerah — struktur, tugas, fungsi, hak, dan wewenang',                             '🏛️', 1),
    ('dprd-kota-semarang','DPRD Kota Semarang',          'Informasi khusus DPRD Kota Semarang — anggota, komisi, fraksi, dan kegiatan',                             '🏙️', 2),
    ('pemerintah-pusat',  'Pemerintah Pusat',            'Lembaga eksekutif, legislatif, dan yudikatif tingkat nasional Republik Indonesia',                         '🇮🇩', 3),
    ('pemerintah-daerah', 'Pemerintah Daerah',           'Pemerintahan tingkat provinsi, kabupaten, dan kota di seluruh Indonesia',                                  '🗺️', 4),
    ('legislasi',         'Legislasi & Regulasi',        'Peraturan perundang-undangan, peraturan daerah, dan proses pembentukan hukum',                            '📜', 5),
    ('konstitusi',        'Konstitusi & Hukum Tata Negara','UUD 1945, amandemen, dan dasar hukum ketatanegaraan Republik Indonesia',                                '⚖️', 6),
    ('pemilu',            'Pemilihan Umum',              'Pemilu legislatif, pilkada, pemilihan presiden, dan sistem pemilihan di Indonesia',                        '🗳️', 7),
    ('otonomi-daerah',    'Otonomi Daerah',              'Desentralisasi, otonomi khusus, dan pembagian kewenangan pusat-daerah',                                   '🔀', 8),
    ('keuangan-daerah',   'Keuangan Daerah',             'APBD, dana alokasi umum/khusus, dan pengelolaan keuangan pemerintah daerah',                              '💰', 9),
    ('pelayanan-publik',  'Pelayanan Publik',            'Standar pelayanan minimal, reformasi birokrasi, dan hak masyarakat atas layanan pemerintah',              '🤝', 10)
ON CONFLICT (slug) DO NOTHING;
