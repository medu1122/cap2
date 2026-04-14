# Database Schema — AIMAP

Database: **PostgreSQL 16**
ORM: **SQLAlchemy 2.x** (async)
Migration tool: **Alembic**

---

## Entity Relationship Diagram

```
users
  │── 1:1 ──► brands
  │── 1:N ──► campaigns
                │── 1:N ──► content_items
                │── 1:N ──► agent_run_logs
                │── 1:N ──► workflow_jobs
```

---

## Table Definitions

### `users`

```sql
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    hashed_pw   VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    role        VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'admin' | 'user'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Admin scope (bo sung)

- `admin`: van hanh he thong, quan tri user, giam sat workflow, xem usage.
- `user`: nguoi dung su dung AIMAP de tao va duyet noi dung marketing.

De phuc vu van hanh admin, bo sung 2 bang he thong:

```sql
CREATE TABLE admin_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id UUID,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value_json JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `brands`

One brand per user (1:1). The Brand Vault.

```sql
CREATE TABLE brands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    brand_name          VARCHAR(255) NOT NULL,
    tagline             VARCHAR(512),
    brand_description   TEXT NOT NULL,
    tone_of_voice       VARCHAR(50) NOT NULL,
                        -- 'playful' | 'professional' | 'warm' | 'bold' | 'informative'
    logo_url            VARCHAR(1024),
    primary_color       VARCHAR(7),             -- hex e.g. "#E23F3F"
    target_audience     TEXT NOT NULL,
    key_products        TEXT[],                 -- array of strings
    forbidden_words     TEXT[],                 -- words agents must avoid
    preferred_cta       VARCHAR(255),
    preferred_salutation VARCHAR(50),           -- e.g. "bạn", "quý khách"
    sample_post         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### `campaigns`

```sql
CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_name       VARCHAR(255) NOT NULL,
    objective           TEXT NOT NULL,
    product_or_service  TEXT NOT NULL,
    target_audience     TEXT,
    offer_or_hook       TEXT,
    deadline            DATE NOT NULL,
    channels            TEXT[] NOT NULL,        -- subset of ['facebook_post','email','video_script']
    additional_notes    TEXT,
    status              VARCHAR(30) NOT NULL DEFAULT 'pending_agent',
                        -- 'pending_agent' | 'running' | 'pending_approval'
                        -- | 'approved' | 'partially_approved' | 'failed'
    error_message       TEXT,
    campaign_plan_json  JSONB,                  -- Strategist output stored here
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

---

### `content_items`

One row per channel per campaign per version.

```sql
CREATE TABLE content_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    channel         VARCHAR(30) NOT NULL,   -- 'facebook_post' | 'email' | 'video_script'
    version         INTEGER NOT NULL DEFAULT 1,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
                    -- 'draft' | 'pending_approval' | 'approved' | 'rejected'
    content_json    JSONB NOT NULL,
                    -- facebook_post: {copy, hashtags}
                    -- email: {subject, body}
                    -- video_script: {hook, body, cta, duration_estimate}
    source          VARCHAR(20) NOT NULL DEFAULT 'agent',   -- 'agent' | 'user_edit'
    agent_run_id    UUID REFERENCES agent_run_logs(id),
    rejection_note  TEXT,
    scheduled_date  DATE,                   -- date shown on calendar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_items_campaign_id ON content_items(campaign_id);
CREATE INDEX idx_content_items_status ON content_items(status);
CREATE INDEX idx_content_items_scheduled_date ON content_items(scheduled_date);
```

---

### `agent_run_logs`

One row per agent step per campaign run.

```sql
CREATE TABLE agent_run_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    agent_name      VARCHAR(50) NOT NULL,   -- 'strategist' | 'writer' | 'critic'
    step_order      INTEGER NOT NULL,       -- 1, 2, 3...
    channel         VARCHAR(30),            -- null for strategist, channel name for writer/critic
    model_used      VARCHAR(100) NOT NULL,  -- 'gpt-4o-mini' | 'qwen2.5:7b'
    model_provider  VARCHAR(20) NOT NULL,   -- 'openai' | 'qwen'
    prompt_preview  TEXT,                   -- first 300 chars of prompt
    output_preview  TEXT,                   -- first 300 chars of output
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    duration_ms     INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'success',  -- 'success' | 'error'
    error_detail    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_run_logs_campaign_id ON agent_run_logs(campaign_id);
```

---

### `workflow_jobs`

Tracks automated workflow triggers.

```sql
CREATE TABLE workflow_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger_type    VARCHAR(50) NOT NULL,
                    -- 'schedule_trigger' | 'upload_trigger' | 'manual'
    trigger_payload JSONB,                  -- e.g. { filename, upload_id } for upload_trigger
    campaign_id     UUID REFERENCES campaigns(id),  -- campaign created by this job
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',
                    -- 'queued' | 'running' | 'completed' | 'failed'
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_jobs_user_id ON workflow_jobs(user_id);
```

---

## Key Queries

### Dashboard stats

```sql
-- Total campaigns per user
SELECT COUNT(*) FROM campaigns WHERE user_id = :user_id;

-- Content items pending approval
SELECT COUNT(*) FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = :user_id AND ci.status = 'pending_approval';

-- Content by channel
SELECT channel, COUNT(*) as cnt
FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = :user_id
GROUP BY channel;
```

### Calendar view (month)

```sql
SELECT ci.id, ci.channel, ci.status, ci.scheduled_date, c.campaign_name
FROM content_items ci
JOIN campaigns c ON c.id = ci.campaign_id
WHERE c.user_id = :user_id
  AND ci.scheduled_date >= :month_start
  AND ci.scheduled_date <= :month_end
  AND ci.version = (
      SELECT MAX(version) FROM content_items ci2
      WHERE ci2.campaign_id = ci.campaign_id AND ci2.channel = ci.channel
  )
ORDER BY ci.scheduled_date;
```

---

## Migration Baseline

```bash
# Initialize alembic
alembic init alembic

# Create first migration
alembic revision --autogenerate -m "initial schema"

# Apply
alembic upgrade head
```
