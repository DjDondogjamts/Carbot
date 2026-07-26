-- CarBot v2.0 Production Schema
-- ==============================

-- 1. Editable System Configuration (no redeploy needed)
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    data_type VARCHAR(20) NOT NULL DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Editable Service Tiers (no redeploy needed)
CREATE TABLE IF NOT EXISTS service_tiers (
    tier INT PRIMARY KEY,
    tier_name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    max_tokens INT NOT NULL DEFAULT 4000,
    max_images INT NOT NULL DEFAULT 5,
    enable_zurkhai BOOLEAN DEFAULT FALSE,
    enable_7step_service BOOLEAN DEFAULT TRUE,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Editable AI Prompts (no redeploy needed)
CREATE TABLE IF NOT EXISTS service_prompts (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    tier VARCHAR(20) NOT NULL,
    prompt_text TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prompts_lookup ON service_prompts(category, tier);

-- 4. Prompt Edit Audit Logs
CREATE TABLE IF NOT EXISTS prompt_audit_logs (
    id SERIAL PRIMARY KEY,
    prompt_id INT REFERENCES service_prompts(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL, -- create/update/delete
    old_value TEXT,
    new_value TEXT,
    edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Core Business Tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    fb_id VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(10),
    source VARCHAR(50) DEFAULT 'organic',
    referrer_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50),
    tier INTEGER REFERENCES service_tiers(tier),
    amount INTEGER,
    paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP,
    zurkhai_opt_in BOOLEAN,
    answers JSONB DEFAULT '{}',
    report_text TEXT,
    followup_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_paid ON sessions(paid);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    amount INTEGER NOT NULL,
    total_cost INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    matched_by VARCHAR(20) DEFAULT 'ai', -- ai/manual
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 6. Manual Payment Override Logs
CREATE TABLE IF NOT EXISTS manual_payment_overrides (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    overridden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_sms (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20),
    amount INTEGER,
    sms_text TEXT NOT NULL,
    parsed_json JSONB,
    delay_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_decisions (
    id SERIAL PRIMARY KEY,
    sms_id INTEGER REFERENCES bank_sms(id),
    session_id INTEGER REFERENCES sessions(id),
    decision VARCHAR(20) NOT NULL,
    reason TEXT,
    confidence NUMERIC(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_calls (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    type VARCHAR(50) NOT NULL,
    model VARCHAR(50) DEFAULT 'moonshot-v1-8k',
    tokens_used INTEGER NOT NULL,
    cost_mnt NUMERIC(10,2) NOT NULL,
    response_time_ms INTEGER NOT NULL,
    dictionary_used BOOLEAN DEFAULT FALSE,
    web_search_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_calls(type);
CREATE INDEX IF NOT EXISTS idx_ai_date ON ai_calls(created_at);

CREATE TABLE IF NOT EXISTS kimi_business_reports (
    id SERIAL PRIMARY KEY,
    report_text TEXT NOT NULL,
    period VARCHAR(50) NOT NULL,
    metrics_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dictionary (
    id SERIAL PRIMARY KEY,
    en VARCHAR(200) NOT NULL,
    mn VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(en, mn)
);

CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    severity VARCHAR(20) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
