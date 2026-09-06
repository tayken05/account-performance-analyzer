-- Account Performance Analyzer — MVP schema for Neon PostgreSQL.
-- Three tables only: models, statistic_collection_runs, statistic_snapshots.
-- Stores raw OnlyFans statistics. Does not define derived metrics or reports.

-- Creators managed by the team. No OnlyFans passwords or session credentials.
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  onlyfans_username TEXT NOT NULL,
  adspower_profile_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT models_onlyfans_username_key UNIQUE (onlyfans_username),
  -- Unique when present; PostgreSQL UNIQUE allows multiple NULLs.
  CONSTRAINT models_adspower_profile_id_key UNIQUE (adspower_profile_id)
);

-- Every automation attempt to collect statistics for a model.
CREATE TABLE statistic_collection_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  source_timezone TEXT,
  error_message TEXT,
  CONSTRAINT statistic_collection_runs_status_check
    CHECK (status IN ('running', 'success', 'failure')),
  CONSTRAINT statistic_collection_runs_completed_at_status_check
    CHECK (
      (status = 'running' AND completed_at IS NULL)
      OR (status = 'success' AND completed_at IS NOT NULL)
      OR (status = 'failure' AND completed_at IS NOT NULL)
    ),
  -- Needed so snapshots can require (collection_run_id, model_id) to match this row.
  CONSTRAINT statistic_collection_runs_id_model_id_key UNIQUE (id, model_id)
);

-- Raw OnlyFans numbers for one model, one successful run, and one period.
CREATE TABLE statistic_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_run_id UUID NOT NULL,
  model_id UUID NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  period_days INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Earnings reported by OnlyFans. Null means not provided, not zero.
  earnings_total NUMERIC(14, 2),
  earnings_gross NUMERIC(14, 2),
  earnings_tips NUMERIC(14, 2),
  earnings_messages NUMERIC(14, 2),
  earnings_direct_messages NUMERIC(14, 2),
  earnings_mass_messages NUMERIC(14, 2),
  earnings_subscriptions NUMERIC(14, 2),
  earnings_posts NUMERIC(14, 2),
  earnings_promotions NUMERIC(14, 2),

  -- Counts reported by OnlyFans. Do not derive one count from another.
  messages_count BIGINT,
  direct_messages_count BIGINT,
  mass_messages_count BIGINT,
  profile_visitors BIGINT,
  guests BIGINT,
  users BIGINT,
  subscribers INTEGER,
  new_subscribers INTEGER,
  renewals INTEGER,
  expired_subscribers INTEGER,
  posts_count INTEGER,
  post_views BIGINT,
  promotion_visitors BIGINT,

  CONSTRAINT statistic_snapshots_period_days_check
    CHECK (period_days IN (1, 2, 7, 30)),
  -- One snapshot per period for a given collection run.
  CONSTRAINT statistic_snapshots_run_period_key
    UNIQUE (collection_run_id, period_days),
  -- Snapshot model must be the same model as the referenced collection run.
  CONSTRAINT statistic_snapshots_collection_run_model_fkey
    FOREIGN KEY (collection_run_id, model_id)
    REFERENCES statistic_collection_runs (id, model_id)
    ON DELETE CASCADE
);

-- Recent collection history for a model.
CREATE INDEX statistic_collection_runs_model_started_at_idx
  ON statistic_collection_runs (model_id, started_at DESC);

-- Historical period lookups: all 7-day snapshots for a model, newest first.
CREATE INDEX statistic_snapshots_model_period_collected_at_idx
  ON statistic_snapshots (model_id, period_days, collected_at DESC);
