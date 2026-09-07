-- One-time migration: add account managers and assignment history
-- to the existing three-table Neon database.
-- Does not alter models, statistic_collection_runs, or statistic_snapshots.

BEGIN;

-- Staff who may be responsible for creator accounts. No login or auth fields.
-- updated_at is initialized by DEFAULT now(); application updates must set it explicitly.
CREATE TABLE account_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_managers_name_key UNIQUE (name)
);

-- Who managed a model, and during which period. ended_at NULL means current.
-- ON DELETE RESTRICT keeps managers with assignment history from being deleted.
CREATE TABLE model_manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models (id) ON DELETE CASCADE,
  account_manager_id UUID NOT NULL REFERENCES account_managers (id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT model_manager_assignments_ended_at_check
    CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX model_manager_assignments_model_id_idx
  ON model_manager_assignments (model_id);

CREATE INDEX model_manager_assignments_account_manager_id_idx
  ON model_manager_assignments (account_manager_id);

-- Only one current assignment per model.
CREATE UNIQUE INDEX model_manager_assignments_one_current_per_model_idx
  ON model_manager_assignments (model_id)
  WHERE ended_at IS NULL;

-- Current models belonging to an account manager.
CREATE INDEX model_manager_assignments_current_by_manager_idx
  ON model_manager_assignments (account_manager_id)
  WHERE ended_at IS NULL;

COMMIT;
