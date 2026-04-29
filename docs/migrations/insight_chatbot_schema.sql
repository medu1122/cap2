-- =====================================================
-- Migration: Tạo bảng mới cho tính năng Insights Chatbot
-- Chạy trên PostgreSQL 16
-- =====================================================

-- 1. Bảng lưu nguồn dữ liệu (table tạo tay hoặc file upload)
CREATE TABLE IF NOT EXISTS insight_data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
    -- Với manual table: schema + data lưu trong JSONB
    schema_json JSONB,
    data_json JSONB,
    -- Với file upload: lưu reference
    file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    original_filename VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_data_sources_user_id ON insight_data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_data_sources_created ON insight_data_sources(created_at DESC);

-- 2. Bảng lưu cuộc hội thoại chat
CREATE TABLE IF NOT EXISTS insight_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_source_id UUID NOT NULL REFERENCES insight_data_sources(id) ON DELETE CASCADE,
    -- Liên kết với insight_report_run nếu có
    insight_run_id UUID REFERENCES insight_report_runs(id) ON DELETE SET NULL,
    title VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_chats_user_id ON insight_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_chats_data_source_id ON insight_chats(data_source_id);
CREATE INDEX IF NOT EXISTS idx_insight_chats_created ON insight_chats(created_at DESC);

-- 3. Bảng lưu từng tin nhắn trong hội thoại
CREATE TABLE IF NOT EXISTS insight_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES insight_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    -- Context của tin nhắn - AI cần biết user đang hỏi về gì
    message_context JSONB,
    -- Với assistant: lưu chart/suggestion đã suggest
    suggested_visualizations JSONB,
    -- Token usage
    input_tokens INTEGER,
    output_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insight_chat_messages_chat_id ON insight_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_insight_chat_messages_created ON insight_chat_messages(created_at);

-- =====================================================
-- Ghi chú:
-- - insight_data_sources.user_id FK đã có index
-- - insight_chats.user_id FK đã có index
-- - insight_chat_messages.chat_id FK đã có index
-- =====================================================
