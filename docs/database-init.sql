-- =============================================================================
-- AIMAP — AI-Powered Marketing Automation Platform for Small Businesses
-- Database Initialization Script
-- PostgreSQL 16
--
-- Cách chạy:
--   psql -U postgres -d aimap -f database-init.sql
--
-- Hoặc tạo database trước:
--   createdb -U postgres aimap
--   psql -U postgres -d aimap -f database-init.sql
-- =============================================================================


-- =============================================================================
-- 0. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()


-- =============================================================================
-- 1. DROP TABLES (nếu cần chạy lại từ đầu — theo thứ tự ngược dependency)
-- =============================================================================

DROP TABLE IF EXISTS content_analytics CASCADE;
DROP TABLE IF EXISTS ai_usage_stats CASCADE;
DROP TABLE IF EXISTS approval_history CASCADE;
DROP TABLE IF EXISTS customer_list_members CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS customer_lists CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;
DROP TABLE IF EXISTS agent_run_logs CASCADE;
DROP TABLE IF EXISTS campaign_tag_assignments CASCADE;
DROP TABLE IF EXISTS campaign_tags CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS content_templates CASCADE;
DROP TABLE IF EXISTS brand_assets CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS workflow_jobs CASCADE;
DROP TABLE IF EXISTS workflow_schedules CASCADE;
DROP TABLE IF EXISTS file_uploads CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_settings CASCADE;
DROP TABLE IF EXISTS email_verifications CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- =============================================================================
-- 2. TABLES — Nhóm 1: Xác thực & Người dùng
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 users — Tài khoản người dùng
-- Mục đích: Lưu thông tin xác thực, phân quyền và hồ sơ cá nhân/doanh nghiệp
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    hashed_pw       VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    phone           VARCHAR(20),
    avatar_url      VARCHAR(1024),
    business_type   VARCHAR(100),           -- cafe, shop, dịch vụ, f&b...
    city            VARCHAR(100),           -- TP.HCM, Hà Nội, Đà Nẵng...
    website         VARCHAR(512),
    role            VARCHAR(20) NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- -----------------------------------------------------------------------------
-- 2.2 user_sessions — Quản lý phiên đăng nhập
-- Mục đích: Refresh token, track thiết bị, đăng xuất tất cả thiết bị
-- -----------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token   VARCHAR(512) NOT NULL,
    device_info     VARCHAR(512),           -- User-Agent string
    ip_address      VARCHAR(45),            -- IPv4/IPv6
    expires_at      TIMESTAMPTZ NOT NULL,   -- 30 ngày kể từ tạo
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_sessions_token UNIQUE (refresh_token)
);

-- -----------------------------------------------------------------------------
-- 2.3 password_reset_tokens — Token đặt lại mật khẩu
-- Mục đích: Luồng "Quên mật khẩu" — token 1 lần dùng, hết hạn sau 1 giờ
-- -----------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,       -- 1 giờ kể từ tạo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prt_token UNIQUE (token)
);

-- -----------------------------------------------------------------------------
-- 2.4 email_verifications — Xác minh địa chỉ email
-- Mục đích: Sau khi đăng ký, gửi email kèm token để xác nhận email hợp lệ
-- -----------------------------------------------------------------------------
CREATE TABLE email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL,
    verified    BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,       -- 24 giờ kể từ tạo
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ev_token UNIQUE (token)
);


-- =============================================================================
-- 3. TABLES — Nhóm 2: Tệp tin (phải tạo trước brands để tránh circular FK)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 file_uploads — Quản lý tệp tin upload
-- Mục đích: Track tất cả file đã upload: logo, CSV danh sách khách, ảnh sản phẩm
-- -----------------------------------------------------------------------------
CREATE TABLE file_uploads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename   VARCHAR(255) NOT NULL,
    stored_path         VARCHAR(1024) NOT NULL,
    file_type           VARCHAR(50) NOT NULL,       -- 'image' | 'csv' | 'document'
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(100),               -- 'image/png', 'text/csv'...
    purpose             VARCHAR(50),                -- 'logo' | 'customer_list' | 'brand_asset'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 4. TABLES — Nhóm 3: Thương hiệu
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 brands — Kho thương hiệu (Brand Vault)
-- Mục đích: DNA thương hiệu — AI agents đọc trước khi sinh bất kỳ nội dung nào
-- Lý do ARRAY: key_products, forbidden_words là danh sách đơn giản, không cần bảng phụ
-- -----------------------------------------------------------------------------
CREATE TABLE brands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_name          VARCHAR(255) NOT NULL,
    tagline             VARCHAR(512),
    brand_description   TEXT NOT NULL,
    tone_of_voice       VARCHAR(50) NOT NULL,   -- playful|professional|warm|bold|informative
    logo_url            VARCHAR(1024),
    primary_color       VARCHAR(7),             -- hex: #RRGGBB
    target_audience     TEXT NOT NULL,
    key_products        TEXT[],                 -- ['Cà phê sữa đá', 'Bạc xỉu']
    forbidden_words     TEXT[],                 -- ['rẻ', 'bình dân']
    preferred_cta       VARCHAR(255),           -- 'Ghé thăm ngay'
    preferred_salutation VARCHAR(50),           -- 'bạn', 'quý khách'
    sample_post         TEXT,                   -- Bài đăng mẫu để AI học phong cách
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brands_user_id UNIQUE (user_id)   -- 1 user : 1 brand vault
);

-- -----------------------------------------------------------------------------
-- 4.2 brand_assets — Tài nguyên thương hiệu
-- Mục đích: Lưu danh sách file liên quan đến thương hiệu (logo, banner, ảnh SP)
-- -----------------------------------------------------------------------------
CREATE TABLE brand_assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_type      VARCHAR(50) NOT NULL,       -- 'logo' | 'banner' | 'product_image'
    file_url        VARCHAR(1024) NOT NULL,
    file_name       VARCHAR(255),
    file_size_bytes INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 5. TABLES — Nhóm 4: Chiến dịch
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 campaigns — Chiến dịch marketing
-- Mục đích: Lưu brief của user và kết quả phân tích của Strategist Agent
-- Lý do JSONB campaign_plan_json: Output của AI có cấu trúc lồng nhau phức tạp
-- Lý do ARRAY channels: Danh sách kênh cố định, không cần bảng phụ
-- -----------------------------------------------------------------------------
CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_name       VARCHAR(255) NOT NULL,
    objective           TEXT NOT NULL,
    product_or_service  TEXT NOT NULL,
    target_audience     TEXT,
    offer_or_hook       TEXT,
    deadline            DATE NOT NULL,
    channels            TEXT[] NOT NULL,        -- ['facebook_post','email','video_script']
    additional_notes    TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_agent',
    -- pending_agent | running | pending_approval | approved | partially_approved | failed
    error_message       TEXT,
    campaign_plan_json  JSONB,                  -- Strategist output: {summary, key_messages, deliverables[]}
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5.2 campaign_tags — Nhãn phân loại chiến dịch
-- Mục đích: Cho phép user phân loại campaign (Tháng 7, Flash Sale, Ra mắt SP...)
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    color       VARCHAR(7),     -- hex màu hiển thị UI
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_tags_user_name UNIQUE (user_id, name)
);

-- -----------------------------------------------------------------------------
-- 5.3 campaign_tag_assignments — Gán nhãn cho chiến dịch (N:M)
-- Mục đích: Junction table giữa campaigns và campaign_tags
-- -----------------------------------------------------------------------------
CREATE TABLE campaign_tag_assignments (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES campaign_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, tag_id)
);


-- =============================================================================
-- 6. TABLES — Nhóm 5: AI & Agent (phải tạo trước content_items do FK)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 agent_run_logs — Nhật ký chạy AI agent
-- Mục đích: Ghi lại từng bước của pipeline Strategist→Writer→Critic.
--           Hiển thị "nhật ký làm việc" trên UI để demo và debugging.
-- -----------------------------------------------------------------------------
CREATE TABLE agent_run_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    agent_name      VARCHAR(50) NOT NULL,       -- 'strategist' | 'writer' | 'critic'
    step_order      INTEGER NOT NULL,           -- thứ tự bước: 1, 2, 3...
    channel         VARCHAR(30),                -- null cho strategist; 'facebook_post'... cho writer/critic
    model_used      VARCHAR(100) NOT NULL,      -- 'gpt-4o-mini' | 'qwen2.5:7b'
    model_provider  VARCHAR(20) NOT NULL,       -- 'openai' | 'qwen'
    prompt_preview  TEXT,                       -- 300 ký tự đầu của prompt (để xem nhanh)
    output_preview  TEXT,                       -- 300 ký tự đầu của output
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    duration_ms     INTEGER,                    -- thời gian chạy tính bằng milliseconds
    status          VARCHAR(20) NOT NULL DEFAULT 'success',     -- 'success' | 'error'
    error_detail    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 6.2 ai_usage_stats — Thống kê sử dụng AI theo tháng
-- Mục đích: Track token dùng, chi phí ước tính, tỉ lệ thành công của từng model
-- -----------------------------------------------------------------------------
CREATE TABLE ai_usage_stats (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year                INTEGER NOT NULL,
    month               INTEGER NOT NULL,           -- 1-12
    model_provider      VARCHAR(20) NOT NULL,       -- 'openai' | 'qwen'
    model_name          VARCHAR(100) NOT NULL,      -- 'gpt-4o-mini' | 'qwen2.5:7b'
    total_input_tokens  INTEGER NOT NULL DEFAULT 0,
    total_output_tokens INTEGER NOT NULL DEFAULT 0,
    total_requests      INTEGER NOT NULL DEFAULT 0,
    failed_requests     INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_usage_stats UNIQUE (user_id, year, month, model_provider, model_name)
);


-- =============================================================================
-- 7. TABLES — Nhóm 6: Nội dung
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7.1 content_items — Nội dung do AI tạo ra
-- Mục đích: Lưu nội dung từng kênh theo từng phiên bản.
-- Lý do JSONB content_json: Cấu trúc khác nhau theo kênh:
--   facebook_post: {copy, hashtags[]}
--   email: {subject, body}
--   video_script: {hook, body, cta, duration_estimate}
-- -----------------------------------------------------------------------------
CREATE TABLE content_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel         VARCHAR(30) NOT NULL,   -- 'facebook_post' | 'email' | 'video_script'
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
    -- draft | pending_approval | approved | rejected
    content_json    JSONB NOT NULL,
    source          VARCHAR(20) NOT NULL DEFAULT 'agent',   -- 'agent' | 'user_edit'
    agent_run_id    UUID REFERENCES agent_run_logs(id) ON DELETE SET NULL,
    rejection_note  TEXT,
    scheduled_date  DATE,                   -- ngày hiển thị trên Marketing Calendar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7.2 content_templates — Mẫu brief tái sử dụng
-- Mục đích: User lưu campaign thành công làm template để tạo nhanh campaign tương tự
-- -----------------------------------------------------------------------------
CREATE TABLE content_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name       VARCHAR(255) NOT NULL,
    objective_template  TEXT,
    product_template    TEXT,
    audience_template   TEXT,
    default_channels    TEXT[],
    notes_template      TEXT,
    use_count           INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 7.3 approval_history — Lịch sử phê duyệt
-- Mục đích: Audit trail đầy đủ của mọi hành động approve/reject — ai, lúc nào, lý do gì
-- -----------------------------------------------------------------------------
CREATE TABLE approval_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id),
    action              VARCHAR(20) NOT NULL,   -- 'approved' | 'rejected' | 'edited'
    note                TEXT,
    content_version     INTEGER NOT NULL,       -- phiên bản content tại thời điểm thao tác
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 8. TABLES — Nhóm 7: Quản lý khách hàng
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 8.1 customer_lists — Danh sách khách hàng upload
-- Mục đích: Khi user upload CSV, hệ thống tạo customer_list và trigger workflow
-- -----------------------------------------------------------------------------
CREATE TABLE customer_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_name       VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'processing',   -- processing | ready | failed
    total_records   INTEGER,
    valid_records   INTEGER,
    file_upload_id  UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8.2 customers — Khách hàng cá nhân
-- Mục đích: Từng bản ghi khách hàng được import từ CSV
-- Lý do JSONB extra_fields: Mỗi doanh nghiệp có cột CSV khác nhau (ngày sinh, điểm tích lũy...)
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_list_id    UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    email               VARCHAR(255),
    full_name           VARCHAR(255),
    phone               VARCHAR(20),
    extra_fields        JSONB,              -- các cột bổ sung từ CSV
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 8.3 customer_list_members — Junction table: khách hàng ↔ danh sách (N:M)
-- Mục đích: 1 khách hàng có thể thuộc nhiều danh sách khác nhau
-- -----------------------------------------------------------------------------
CREATE TABLE customer_list_members (
    customer_list_id    UUID NOT NULL REFERENCES customer_lists(id) ON DELETE CASCADE,
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_list_id, customer_id)
);


-- =============================================================================
-- 9. TABLES — Nhóm 8: Thông báo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9.1 notifications — Thông báo trong ứng dụng
-- Mục đích: In-app notification center — campaign xong, content chờ duyệt, workflow chạy
-- Lý do JSONB payload: Mỗi loại thông báo có metadata khác nhau
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,       -- 'campaign_complete' | 'content_pending' | 'workflow_done'
    title       VARCHAR(255) NOT NULL,
    body        TEXT NOT NULL,
    payload     JSONB,                      -- {campaign_id, content_count, ...}
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9.2 notification_settings — Cài đặt thông báo của người dùng
-- Mục đích: User tùy chỉnh loại thông báo muốn nhận
-- -----------------------------------------------------------------------------
CREATE TABLE notification_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_completed  BOOLEAN NOT NULL DEFAULT TRUE,
    content_pending     BOOLEAN NOT NULL DEFAULT TRUE,
    workflow_triggered  BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notification_settings_user UNIQUE (user_id)
);


-- =============================================================================
-- 10. TABLES — Nhóm 9: Workflow & Tự động hóa
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10.1 workflow_schedules — Cấu hình lịch tự động
-- Mục đích: Lưu CẤU HÌNH lịch (1 lần tạo, nhiều lần chạy) — phân biệt với workflow_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE workflow_schedules (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_name           VARCHAR(255) NOT NULL,
    trigger_type            VARCHAR(50) NOT NULL,   -- 'schedule_trigger' | 'upload_trigger'
    cron_expression         VARCHAR(100),           -- '0 8 * * 1' = thứ Hai 8 giờ sáng
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    default_brief_template  JSONB,                  -- template brief mặc định khi trigger
    last_run_at             TIMESTAMPTZ,
    next_run_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 10.2 workflow_jobs — Phiên chạy workflow
-- Mục đích: Ghi lại từng LẦN workflow được kích hoạt (1 schedule → nhiều jobs)
-- -----------------------------------------------------------------------------
CREATE TABLE workflow_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type    VARCHAR(50) NOT NULL,
    trigger_payload JSONB,                  -- {filename, upload_id} cho upload_trigger
    campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    schedule_id     UUID REFERENCES workflow_schedules(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',   -- queued | running | completed | failed
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 11. TABLES — Nhóm 10: Phân tích hiệu quả
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 11.1 content_analytics — Chỉ số hiệu quả nội dung
-- Mục đích: Lưu metrics của từng content item (views, clicks, likes...)
--           MVP: dùng mock data; mở rộng sau: kết nối API thực
-- -----------------------------------------------------------------------------
CREATE TABLE content_analytics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id     UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    views               INTEGER NOT NULL DEFAULT 0,
    clicks              INTEGER NOT NULL DEFAULT 0,
    likes               INTEGER NOT NULL DEFAULT 0,
    shares              INTEGER NOT NULL DEFAULT 0,
    comments            INTEGER NOT NULL DEFAULT 0,
    click_through_rate  NUMERIC(5,2),       -- CTR = clicks/views × 100 (%)
    data_source         VARCHAR(50) NOT NULL DEFAULT 'mock',   -- 'mock' | 'facebook_api' | 'email_esp'
    recorded_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_content_analytics_item UNIQUE (content_item_id)
);


-- =============================================================================
-- 12. INDEXES
-- =============================================================================

-- users
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(refresh_token);

-- password_reset_tokens
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);
CREATE UNIQUE INDEX idx_prt_token ON password_reset_tokens(token);

-- campaigns
CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_deadline ON campaigns(deadline);

-- content_items
CREATE INDEX idx_content_items_campaign_id ON content_items(campaign_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_scheduled_date ON content_items(scheduled_date);
CREATE INDEX idx_content_items_channel ON content_items(channel);

-- agent_run_logs
CREATE INDEX idx_agent_run_logs_campaign_id ON agent_run_logs(campaign_id);
CREATE INDEX idx_agent_run_logs_created_at ON agent_run_logs(created_at DESC);

-- brand_assets
CREATE INDEX idx_brand_assets_brand_id ON brand_assets(brand_id);

-- campaign_tag_assignments
CREATE INDEX idx_cta_campaign_id ON campaign_tag_assignments(campaign_id);
CREATE INDEX idx_cta_tag_id ON campaign_tag_assignments(tag_id);

-- customer_lists
CREATE INDEX idx_customer_lists_user_id ON customer_lists(user_id);

-- customers
CREATE INDEX idx_customers_customer_list_id ON customers(customer_list_id);
CREATE INDEX idx_customers_email ON customers(email);

-- file_uploads
CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);

-- notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ai_usage_stats
CREATE INDEX idx_ai_usage_stats_user_id ON ai_usage_stats(user_id);

-- workflow_schedules
CREATE INDEX idx_workflow_schedules_user_id ON workflow_schedules(user_id);
CREATE INDEX idx_workflow_schedules_next_run ON workflow_schedules(next_run_at)
    WHERE is_active = TRUE;

-- workflow_jobs
CREATE INDEX idx_workflow_jobs_user_id ON workflow_jobs(user_id);
CREATE INDEX idx_workflow_jobs_status ON workflow_jobs(status);

-- approval_history
CREATE INDEX idx_approval_history_content_item_id ON approval_history(content_item_id);
CREATE INDEX idx_approval_history_user_id ON approval_history(user_id);

-- content_templates
CREATE INDEX idx_content_templates_user_id ON content_templates(user_id);


-- =============================================================================
-- 13. SAMPLE DATA — Dữ liệu mẫu demo
-- =============================================================================

-- Lưu ý: hashed_pw bên dưới tương đương password "demo1234" (bcrypt)
-- Trong production, không bao giờ lưu plain text password

-- -----------------------------------------------------------------------------
-- 13.1 User demo
-- -----------------------------------------------------------------------------
INSERT INTO users (
    id, email, hashed_pw, full_name, phone,
    business_type, city, role, is_active, email_verified
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'demo@cafebohho.vn',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGX5SXRwI3nk/s1AeOHGz7HNwOi',  -- demo1234
    'Nguyễn Văn Demo',
    '0901234567',
    'cafe',
    'TP.HCM',
    'user',
    TRUE,
    TRUE
);

-- -----------------------------------------------------------------------------
-- 13.2 Notification settings mặc định cho user demo
-- -----------------------------------------------------------------------------
INSERT INTO notification_settings (user_id)
VALUES ('11111111-1111-1111-1111-111111111111');

-- -----------------------------------------------------------------------------
-- 13.3 Brand Vault cho Cafe Bờ Hồ
-- -----------------------------------------------------------------------------
INSERT INTO brands (
    id, user_id, brand_name, tagline, brand_description,
    tone_of_voice, primary_color, target_audience,
    key_products, forbidden_words, preferred_cta, preferred_salutation,
    sample_post
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Cafe Bờ Hồ',
    'Ngụm cà phê, ngàn ký ức',
    'Quán cà phê nhỏ ở trung tâm TP.HCM, chuyên phục vụ cà phê truyền thống Việt Nam. Mở cửa từ 7 giờ sáng đến 10 giờ tối mỗi ngày.',
    'warm',
    '#7B5B3A',
    'Học sinh sinh viên 18-25 tuổi và dân văn phòng trẻ thích không gian yên tĩnh',
    ARRAY['Cà phê sữa đá', 'Bạc xỉu', 'Trà đào cam sả', 'Cà phê trứng', 'Sinh tố bơ'],
    ARRAY['rẻ', 'bình dân', 'giảm sốc', 'siêu rẻ'],
    'Ghé thăm ngay',
    'bạn',
    'Mùa mưa về, một ly bạc xỉu nóng tại Cafe Bờ Hồ sẽ làm ấm lòng bạn ngay thôi ☕ Ghé thăm chúng mình nha!'
);

-- -----------------------------------------------------------------------------
-- 13.4 Campaign 1 — Đã hoàn thành và được duyệt
-- -----------------------------------------------------------------------------
INSERT INTO campaigns (
    id, user_id, campaign_name, objective, product_or_service,
    target_audience, offer_or_hook, deadline, channels, status,
    campaign_plan_json
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Khai trương menu mùa hè',
    'Ra mắt các thức uống mới mùa hè, tăng lượng khách ghé thử',
    'Trà đào cam sả và Cà phê đá xay',
    'Học sinh sinh viên và dân văn phòng 20-30 tuổi',
    'Mua 2 ly tặng 1 bánh flan trong tuần đầu',
    CURRENT_DATE + INTERVAL '7 days',
    ARRAY['facebook_post', 'email'],
    'approved',
    '{"campaign_summary": "Chiến dịch giới thiệu menu mùa hè với 2 thức uống mới: Trà đào cam sả và Cà phê đá xay. Nhấn mạnh sự tươi mát, phù hợp mùa nắng và ưu đãi hấp dẫn trong tuần đầu.", "key_messages": ["Mùa hè mát lạnh với menu mới của Cafe Bờ Hồ", "Nguyên liệu tươi sạch, không phẩm màu nhân tạo", "Ưu đãi mua 2 tặng 1 chỉ trong tuần đầu ra mắt"], "deliverables": [{"channel": "facebook_post", "content_goal": "Tạo buzz và thu hút khách ghé thử menu mới", "tone_hint": "Vui tươi, năng động, dùng emoji phù hợp", "cta": "Ghé thăm ngay hôm nay"}, {"channel": "email", "content_goal": "Thông báo ưu đãi đến khách hàng thân thiết", "tone_hint": "Ấm áp, trân trọng, nhắc đến sự gắn bó lâu dài", "cta": "Ghé thăm chúng mình trong tuần này"}]}'::jsonb
);

-- Agent logs cho campaign 1
INSERT INTO agent_run_logs (
    id, campaign_id, agent_name, step_order,
    model_used, model_provider, duration_ms, input_tokens, output_tokens, status,
    prompt_preview, output_preview
) VALUES
(
    'aaa11111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    'strategist', 1,
    'gpt-4o-mini', 'openai', 2340, 412, 280, 'success',
    'You are a senior marketing strategist. Analyze the following campaign brief and brand context to create a structured campaign plan...',
    '{"campaign_summary": "Chiến dịch giới thiệu menu mùa hè với 2 thức uống mới..."}'
),
(
    'aaa22222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'writer', 2,
    'qwen2.5:7b', 'qwen', 4120, 540, 320, 'success',
    'Viết bài đăng Facebook cho chiến dịch ra mắt menu mùa hè của Cafe Bờ Hồ. Giọng văn ấm áp...',
    '{"copy": "Mùa hè đã đến rồi bạn ơi! ☀️ Cafe Bờ Hồ vừa ra mắt menu mùa hè với..."}'
),
(
    'aaa33333-3333-3333-3333-333333333333',
    '33333333-3333-3333-3333-333333333333',
    'critic', 3,
    'gpt-4o-mini', 'openai', 3210, 620, 290, 'success',
    'Review the following Facebook post draft against brand guidelines and campaign objectives...',
    '{"status": "approved", "issues_found": [], "final_content": {"copy": "Mùa hè đã đến rồi bạn ơi!..."}}'
),
(
    'aaa44444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'writer', 4,
    'qwen2.5:7b', 'qwen', 3890, 510, 380, 'success',
    'Viết email marketing cho chiến dịch ra mắt menu mùa hè của Cafe Bờ Hồ...',
    '{"subject": "Menu mùa hè mới đã có mặt tại Cafe Bờ Hồ!", "body": "Xin chào bạn,\n\nMùa hè năm nay..."}'
),
(
    'aaa55555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    'critic', 5,
    'gpt-4o-mini', 'openai', 2980, 590, 260, 'success',
    'Review the following email draft against brand guidelines...',
    '{"status": "revised", "issues_found": ["Phần mở đầu hơi cứng nhắc, cần thêm sự ấm áp"], "final_content": {...}}'
);

-- Content items cho campaign 1
INSERT INTO content_items (
    campaign_id, channel, version, status, content_json, agent_run_id, scheduled_date
) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    'facebook_post', 1, 'approved',
    '{"copy": "Mùa hè đã đến rồi bạn ơi! ☀️\n\nCafe Bờ Hồ vừa ra mắt menu mùa hè với hai thức uống mới:\n🍑 Trà đào cam sả — Vị thanh mát, thơm nhẹ, giải nhiệt tuyệt vời\n☕ Cà phê đá xay — Đậm vị espresso, mịn màng như kem\n\nĐặc biệt tuần này: Mua 2 ly tặng 1 bánh flan!\n\nGhé thăm ngay nhé bạn, chúng mình đang chờ!", "hashtags": ["CafeBờHồ", "MenuMùaHè", "CàPhêSàiGòn", "TràĐào", "Refreshing", "CafeViệt"]}'::jsonb,
    'aaa33333-3333-3333-3333-333333333333',
    CURRENT_DATE + INTERVAL '3 days'
),
(
    '33333333-3333-3333-3333-333333333333',
    'email', 1, 'approved',
    '{"subject": "Menu mùa hè mới đã có mặt tại Cafe Bờ Hồ! 🌞", "body": "Xin chào bạn thân mến,\n\nMùa hè năm nay, Cafe Bờ Hồ mang đến cho bạn những thức uống mới thật mát lành và tươi sáng!\n\nChúng mình vừa ra mắt:\n• Trà đào cam sả — Hương thơm tự nhiên, không phẩm màu\n• Cà phê đá xay — Đậm đà, mịn màng, đúng vị espresso\n\nVà đặc biệt, trong tuần đầu ra mắt: MUA 2 LY TẶNG 1 BÁNH FLAN!\n\nGhé thăm chúng mình nhé, luôn có chỗ cho bạn tại Cafe Bờ Hồ.\n\nTrân trọng,\nCafe Bờ Hồ"}'::jsonb,
    'aaa55555-5555-5555-5555-555555555555',
    CURRENT_DATE + INTERVAL '4 days'
);

-- AI usage stats cho tháng này
INSERT INTO ai_usage_stats (
    user_id, year, month, model_provider, model_name,
    total_input_tokens, total_output_tokens, total_requests, failed_requests
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    EXTRACT(YEAR FROM NOW())::INTEGER,
    EXTRACT(MONTH FROM NOW())::INTEGER,
    'openai', 'gpt-4o-mini',
    1622, 830, 3, 0
),
(
    '11111111-1111-1111-1111-111111111111',
    EXTRACT(YEAR FROM NOW())::INTEGER,
    EXTRACT(MONTH FROM NOW())::INTEGER,
    'qwen', 'qwen2.5:7b',
    1050, 700, 2, 0
);

-- -----------------------------------------------------------------------------
-- 13.5 Campaign 2 — Đang chờ duyệt
-- -----------------------------------------------------------------------------
INSERT INTO campaigns (
    id, user_id, campaign_name, objective, product_or_service,
    offer_or_hook, deadline, channels, status
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Khuyến mãi cuối tuần',
    'Tăng lượng khách ghé quán vào cuối tuần',
    'Toàn bộ thức uống trong menu',
    'Giảm 15% khi order từ 2 ly bất kỳ',
    CURRENT_DATE + INTERVAL '10 days',
    ARRAY['facebook_post', 'email', 'video_script'],
    'pending_approval'
);

INSERT INTO content_items (campaign_id, channel, version, status, content_json, scheduled_date)
VALUES
(
    '44444444-4444-4444-4444-444444444444',
    'facebook_post', 1, 'pending_approval',
    '{"copy": "Cuối tuần thư giãn tại Cafe Bờ Hồ! 🎉\n\nGiảm 15% khi bạn order từ 2 ly bất kỳ. Mang theo bạn bè và người thân, cùng nhau tận hưởng không gian yên tĩnh và thức uống ngon nhé!\n\nChương trình áp dụng cả Thứ 7 và Chủ Nhật. Ghé thăm ngay!", "hashtags": ["CafeBờHồ", "CuốiTuần", "Giảmgiá", "CaféViệt", "Weekend"]}'::jsonb,
    CURRENT_DATE + INTERVAL '8 days'
),
(
    '44444444-4444-4444-4444-444444444444',
    'email', 1, 'pending_approval',
    '{"subject": "Cuối tuần này - Giảm 15% cho mọi đơn từ 2 ly tại Cafe Bờ Hồ 🎁", "body": "Xin chào bạn,\n\nCuối tuần này, hãy cùng bạn bè ghé thăm Cafe Bờ Hồ và thưởng thức chương trình đặc biệt:\n\nGIẢM 15% khi order từ 2 ly bất kỳ!\n\nChương trình áp dụng từ 8:00 - 22:00 mỗi Thứ 7 và Chủ Nhật.\n\nChúng mình đang chờ bạn!\n\nCafe Bờ Hồ"}'::jsonb,
    CURRENT_DATE + INTERVAL '9 days'
),
(
    '44444444-4444-4444-4444-444444444444',
    'video_script', 1, 'pending_approval',
    '{"hook": "Bạn đã có kế hoạch cho cuối tuần này chưa?", "body": "Cuối tuần này, Cafe Bờ Hồ có chương trình cực hấp dẫn! Mua từ 2 ly bất kỳ là bạn được giảm ngay 15%. Không gian yên tĩnh, thức uống ngon, giá lại ưu đãi — còn gì tuyệt hơn!", "cta": "Ghé thăm Cafe Bờ Hồ ngay cuối tuần này nhé!", "duration_estimate": "30s"}'::jsonb,
    CURRENT_DATE + INTERVAL '10 days'
);

-- -----------------------------------------------------------------------------
-- 13.6 Notifications mẫu
-- -----------------------------------------------------------------------------
INSERT INTO notifications (user_id, type, title, body, payload)
VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'campaign_complete',
    'Chiến dịch đã sẵn sàng để duyệt',
    'Chiến dịch "Khuyến mãi cuối tuần" đã được AI soạn xong. Bạn có 3 nội dung đang chờ duyệt.',
    '{"campaign_id": "44444444-4444-4444-4444-444444444444", "content_count": 3}'::jsonb
),
(
    '11111111-1111-1111-1111-111111111111',
    'content_pending',
    '3 nội dung đang chờ bạn duyệt',
    'Bạn có 3 nội dung từ chiến dịch "Khuyến mãi cuối tuần" đang chờ phê duyệt.',
    '{"pending_count": 3}'::jsonb
);

-- -----------------------------------------------------------------------------
-- 13.7 Campaign tag mẫu
-- -----------------------------------------------------------------------------
INSERT INTO campaign_tags (user_id, name, color)
VALUES
('11111111-1111-1111-1111-111111111111', 'Ra mắt sản phẩm', '#2563EB'),
('11111111-1111-1111-1111-111111111111', 'Khuyến mãi', '#16A34A'),
('11111111-1111-1111-1111-111111111111', 'Cuối tuần', '#D97706');

-- -----------------------------------------------------------------------------
-- 13.8 Content analytics mẫu (mock data)
-- -----------------------------------------------------------------------------
INSERT INTO content_analytics (content_item_id, views, clicks, likes, shares, click_through_rate, data_source)
SELECT id, 
       (RANDOM() * 500 + 100)::INTEGER,
       (RANDOM() * 80 + 20)::INTEGER,
       (RANDOM() * 50 + 10)::INTEGER,
       (RANDOM() * 20 + 5)::INTEGER,
       (RANDOM() * 15 + 2)::NUMERIC(5,2),
       'mock'
FROM content_items
WHERE status = 'approved';


-- =============================================================================
-- 14. KIỂM TRA (chạy sau khi init để xác nhận)
-- =============================================================================

-- Đếm số bảng đã tạo (kết quả phải là 23)
SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Kiểm tra dữ liệu demo
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'brands', COUNT(*) FROM brands
UNION ALL SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL SELECT 'content_items', COUNT(*) FROM content_items
UNION ALL SELECT 'agent_run_logs', COUNT(*) FROM agent_run_logs
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'ai_usage_stats', COUNT(*) FROM ai_usage_stats;

-- =============================================================================
-- 15. ADMIN GOVERNANCE TABLES (Bo sung)
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_action_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type     VARCHAR(100) NOT NULL,
    target_type     VARCHAR(100),
    target_id       UUID,
    payload_json    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user_id ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action_type ON admin_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at ON admin_action_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value_json      JSONB NOT NULL,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
