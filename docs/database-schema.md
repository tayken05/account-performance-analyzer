# MVP Database Schema

This document describes the initial Neon PostgreSQL structure for the Account Performance Analyzer.

It is a design only. This is not a migration and does not include executable SQL.

The MVP stores **raw OnlyFans statistics** as historical snapshots. Application logic will later compare those snapshots for 1, 2, 7, and 30 day periods. AI will explain already-calculated findings. It will not invent metrics or perform the important numerical comparisons.

Account managers are stored as rows, not hard-coded names. A model’s manager can change over time. `model_manager_assignments` preserves who was responsible during each period so historical reports are not attributed to the wrong person.

Out of scope for this schema:

- Derived or custom metrics that OnlyFans does not directly provide
- Anomaly detection or any placeholder for it
- Social Media Ideas / Content Assistant tables
- Authentication, login, email, password, role, or user-account tables
- OnlyFans passwords, session tokens, cookies, 2FA secrets, or other login credentials

AdsPower profile IDs are allowed and are stored on each model.

## Design summary

Five tables:

1. `account_managers` — staff who may be responsible for creator accounts
2. `models` — the creators we manage
3. `model_manager_assignments` — who managed a model, and during which period
4. `statistic_collection_runs` — every automation attempt to collect statistics
5. `statistic_snapshots` — the raw OnlyFans numbers collected for a specific model and date range

Extra tables per metric area (earnings, traffic, messages, and so on) would add complexity without helping the first analyzer.

```text
account_managers
  1 ──< model_manager_assignments >── 1  models
                                         1 ──< statistic_collection_runs
                                                 1 ──< statistic_snapshots
```

- One account manager has many assignments.
- One model has many assignments over time, but only one current assignment (`ended_at` is NULL).
- A model has many collection runs.
- A successful run stores one snapshot per collected period (1, 2, 7, and 30 days). A failed run stores no snapshots and keeps a safe error message instead.

Do **not** store an account manager’s name as free text on `models`. Do **not** make `models.account_manager_id` the sole source of manager responsibility. Current and historical responsibility live only in `model_manager_assignments`.

## 1. `account_managers`

**Purpose:** One row per account manager who may be responsible for creator/model accounts.

Managers are not hard-coded in application code. A later Account Managers management page will add, deactivate, reactivate, and (when safe) permanently delete managers. Active managers will later populate the Account Manager dropdown on the Add Model form.

### Important columns

| Column | Meaning |
| --- | --- |
| `id` | Internal primary key (UUID). Default `gen_random_uuid()`. |
| `name` | Account manager’s name. Required. Unique. |
| `is_active` | Whether this manager can receive new assignments. Default `TRUE`. |
| `created_at` | When this manager row was created. Default `now()`. |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()`. `DEFAULT now()` sets the value when the row is created. Future application update actions must explicitly set `updated_at = now()` whenever the manager record is changed. No database trigger is added for this in the MVP. |

Do **not** add authentication, login, email, password, role, or user-account fields to this table.

### Manager lifecycle

When a manager leaves the agency, they should normally be marked inactive rather than deleted.

- Inactive managers must not appear in dropdowns for new assignments.
- Historical assignments belonging to inactive managers must remain intact.

If a manager still has current model assignments, the application must not silently deactivate them and leave those models without a current manager. The future UI should require those models to be reassigned before deactivation completes, or explicitly handle their assignments.

After deactivation:

- the manager remains in historical records
- the manager no longer appears in new-assignment dropdowns
- historical analysis remains accurate

### Permanent deletion

- An accidentally created manager with **no** model assignments (current or historical) may be permanently deleted.
- A manager with any assignment history must **not** be permanently deleted. Deactivate them instead.
- `model_manager_assignments.account_manager_id` references `account_managers.id` with **ON DELETE RESTRICT**, so PostgreSQL rejects deleting a manager who still has assignment rows.

## 2. `models`

**Purpose:** One row per creator account the team manages.

This is the stable identity the rest of the app hangs off. Automation will later open the matching AdsPower profile and collect OnlyFans statistics for that model.

`is_active` on this table means whether the **creator account** is currently managed and analyzed. It is not the account manager’s active flag.

### Important columns

| Column | Meaning |
| --- | --- |
| `id` | Internal primary key (UUID). Used in all relationships. Not the OnlyFans username. |
| `display_name` | Stage / display name shown to account managers. |
| `onlyfans_username` | Public OnlyFans username. Unique among models. Used to identify the creator account, not to log in. |
| `adspower_profile_id` | AdsPower profile ID the automation will use to open this account. Unique when present, so two active models cannot accidentally reference the same AdsPower browser profile. |
| `is_active` | Whether the model is currently included in collection and analysis. Inactive models are kept for history. |
| `created_at` | When this model row was created. |
| `updated_at` | When this model row was last changed. |

`adspower_profile_id` should be unique when present so two active models cannot accidentally share the same AdsPower browser profile.

Do **not** store OnlyFans passwords, emails used only for login, 2FA secrets, session cookies, or AdsPower login credentials.

Do **not** store the account manager’s name as free text on this table. Do **not** add `account_manager_id` here as the only record of who is responsible. Use `model_manager_assignments`.

## 3. `model_manager_assignments`

**Purpose:** Record which account manager was responsible for a model during a specific period of time.

A model may have many historical assignments. Only one assignment per model may be current (`ended_at` IS NULL).

### Important columns

| Column | Meaning |
| --- | --- |
| `id` | Internal primary key (UUID). Default `gen_random_uuid()`. |
| `model_id` | The model this assignment belongs to. Required. References `models.id`. |
| `account_manager_id` | The manager responsible during this period. Required. References `account_managers.id`. |
| `started_at` | When this responsibility period began. Required. Default `now()`. |
| `ended_at` | When this responsibility period ended. NULL means this is the current assignment. |
| `created_at` | When this assignment row was created. Default `now()`. |

### Relationships and delete behavior

- **`model_id` → `models.id`** with **ON DELETE CASCADE**. Removing a model also removes its assignment history.
- **`account_manager_id` → `account_managers.id`** with **ON DELETE RESTRICT**. PostgreSQL will not delete a manager who has current or historical assignments. That protects historical responsibility records. Managers with assignment history should be deactivated rather than deleted.

### Check constraint

`ended_at` must be NULL for a current assignment, **or** when `ended_at` is present it must be later than `started_at`.

In other words:

- current assignment: `ended_at IS NULL`
- closed assignment: `ended_at IS NOT NULL` and `ended_at > started_at`

### One current assignment per model

A model may have many historical rows, but only **one** current assignment at a time.

Enforce this with a partial unique index (or equivalent PostgreSQL design):

- unique on `model_id`
- only for rows where `ended_at IS NULL`

That prevents two open assignments for the same model.

### Useful indexes

- `model_manager_assignments(model_id)` — assignment history for a model
- `model_manager_assignments(account_manager_id)` — all work belonging to a manager
- current assignment lookup by model — the partial unique index on `model_id WHERE ended_at IS NULL`
- current models belonging to an account manager — a partial index on `account_manager_id WHERE ended_at IS NULL`

## Assignment lifecycle

These steps are the intended application behavior. They are not implemented in this documentation step.

### When a new model is created

1. The user selects an **active** account manager from a database-driven dropdown.
2. The model is created.
3. A current `model_manager_assignments` row is created with:
   - `model_id`
   - `account_manager_id`
   - `started_at`
   - `ended_at = NULL`

### When a model is reassigned

1. Find the model’s current assignment (`ended_at IS NULL`).
2. Set that row’s `ended_at` to the reassignment time.
3. Create a new assignment for the new manager with `ended_at = NULL`.

Example:

| Model | Manager | Period |
| --- | --- | --- |
| Daisy | Sarah | 5 January → 7 September |
| Daisy | Michelle | 7 September → current |

The application can then answer both:

- Who manages Daisy now?
- Who managed Daisy during an earlier reporting period?

## 4. `statistic_collection_runs`

**Purpose:** Record every time automation collects statistics for a model, including failures.

Collection is an operational event. It is separate from the numbers themselves so we can see that a run happened even when OnlyFans data could not be saved.

### Important columns

| Column | Meaning |
| --- | --- |
| `id` | Internal primary key (UUID). |
| `model_id` | The model this run belongs to. References `models.id`. |
| `started_at` | When collection started. |
| `completed_at` | When collection finished. Empty while the run is `running`. |
| `status` | `running`, `success`, or `failure`. A newly started run begins as `running`. It becomes `success` when collection finishes successfully, or `failure` when collection fails. |
| `source_timezone` | Timezone shown by OnlyFans for the collected statistics, for example `UTC-05:00`. Nullable. Preserved so historical period boundaries can later be interpreted correctly. Not a separate timezone table. |
| `error_message` | Safe, short message when collection failed. Empty on success. |

`error_message` must be safe to show internally. It may say that a page did not load or that a profile was unavailable. It must not include connection strings, passwords, cookies, session tokens, OnlyFans page HTML, stack traces, or hostnames that expose infrastructure.

`completed_at` must match the status:

- `running` → `completed_at` MUST be NULL
- `success` → `completed_at` MUST NOT be NULL
- `failure` → `completed_at` MUST NOT be NULL

Unique pair `(id, model_id)` is required so snapshots can prove they belong to the same model as the run.

### Relationship

- Many collection runs belong to one model.
- Deleting a model later would also remove its runs and snapshots. The MVP does not need a special archive table for this.

## 5. `statistic_snapshots`

**Purpose:** Store the raw OnlyFans statistics for one model, one collection run, and one reporting period.

This is the table the analyzer will read. Each row is a point-in-time copy of what OnlyFans reported for a date range. We keep every snapshot so later periods can be compared.

A successful collection run should normally write four snapshots:

- 1 day
- 2 days
- 7 days
- 30 days

If OnlyFans does not provide a value, that column stays empty. Empty means “not collected / not available”, not zero.

### Identity and period columns

| Column | Meaning |
| --- | --- |
| `id` | Internal primary key (UUID). |
| `collection_run_id` | The run that produced this snapshot. References `statistic_collection_runs.id`. |
| `model_id` | The model these numbers belong to. References `models.id`. Repeated here so period queries do not always need a join. |
| `period_days` | The intended analysis window: `1`, `2`, `7`, or `30`. |
| `period_start` | First date of the OnlyFans range that was collected. |
| `period_end` | Last date of the OnlyFans range that was collected. |
| `collected_at` | When these numbers were read. Matches the successful run closely. |

`period_start` and `period_end` record the actual calendar window. `period_days` records which analyzer period that window was collected for. Together they let us compare “this 7-day snapshot” with an earlier 7-day snapshot without guessing dates.

One run should not store two snapshots for the same `period_days`.

A snapshot’s `(collection_run_id, model_id)` must match the same `statistic_collection_runs` row. Do not allow a snapshot to point at a run for one model and a `model_id` for another.

### Raw statistic columns

Store OnlyFans values as they were reported. Do not pre-compute rates, averages, conversion, or other derived metrics.

Money values should be decimal numbers. Counts should be whole numbers. Use empty/null when OnlyFans did not give that figure.

**Earnings**

| Column | Meaning |
| --- | --- |
| `earnings_total` | Overall earnings for the period. |
| `earnings_gross` | Gross earnings when OnlyFans provides them. Optional. |
| `earnings_tips` | Tip earnings. |
| `earnings_messages` | Message earnings. |
| `earnings_direct_messages` | Direct-message / chat earnings when OnlyFans reports them. Optional. Store the raw OnlyFans value. Do not derive it by subtracting other message fields. |
| `earnings_mass_messages` | Mass message earnings. |
| `earnings_subscriptions` | Subscription earnings. |
| `earnings_posts` | Post / pay-per-view earnings. |
| `earnings_promotions` | Promotion earnings when OnlyFans provides them. Optional. |

**Messages, direct messages, and mass messages**

| Column | Meaning |
| --- | --- |
| `messages_count` | Number of messages. |
| `direct_messages_count` | Number of direct messages when OnlyFans provides it. Optional. Store the raw OnlyFans value. Do not derive it by subtracting other message counts. |
| `mass_messages_count` | Number of mass messages. |

**Traffic**

| Column | Meaning |
| --- | --- |
| `profile_visitors` | Profile visitors / traffic. |
| `guests` | Guest visitors when OnlyFans provides them. |
| `users` | Logged-in user visitors when OnlyFans provides them. |

**Subscribers and retention**

| Column | Meaning |
| --- | --- |
| `subscribers` | Subscriber count reported for the period or as of collection, according to what OnlyFans shows. |
| `new_subscribers` | New subscribers. |
| `renewals` | Renewals. |
| `expired_subscribers` | Expired or cancelled subscribers when OnlyFans provides them. Optional, for retention. |

**Wall / posts**

| Column | Meaning |
| --- | --- |
| `posts_count` | Number of posts / wall items reported for the period. |
| `post_views` | Post views. |

**Promotions**

| Column | Meaning |
| --- | --- |
| `promotion_visitors` | Traffic attributed to promotions when OnlyFans provides it. Optional. |

No other promotion system is needed in the MVP. If OnlyFans later exposes a clearly useful core promotion statistic, add it as another nullable column on this same table rather than creating a promotions table.

Do not add columns for custom metrics such as conversion rate, earnings per subscriber, or “health scores”. Those are later, if requested.

## Relationships

- **`account_managers.id` → `model_manager_assignments.account_manager_id`**  
  One manager has many assignments. **ON DELETE RESTRICT.**

- **`models.id` → `model_manager_assignments.model_id`**  
  One model has many assignments over time. **ON DELETE CASCADE.**

- **`models.id` → `statistic_collection_runs.model_id`**  
  Each run is for exactly one model. A model can have many runs over time.

- **`statistic_collection_runs.id` → `statistic_snapshots.collection_run_id`**  
  Snapshots are produced by a successful run. A failed run has zero snapshots. Combined with `model_id`, this is a composite foreign key to `(statistic_collection_runs.id, statistic_collection_runs.model_id)` so the snapshot’s model cannot disagree with the run.

- **`models.id` → `statistic_snapshots.model_id`**  
  Each snapshot belongs to one model. This supports queries such as “all 7-day snapshots for this model, newest first”. Keep this direct relationship.

Typical successful collection:

1. Insert a `statistic_collection_runs` row with `status` `running`, `started_at` set, and `completed_at` empty.
2. Collect raw OnlyFans statistics for the 1, 2, 7, and 30 day ranges.
3. Insert four `statistic_snapshots` rows.
4. Set `status` to `success` and set `completed_at`.

Typical failed collection:

1. Insert the run as `running`, as above.
2. Store a safe `error_message`.
3. Set `status` to `failure` and set `completed_at`.
4. Insert no snapshots, so old history stays the last good data.

Approved collection-run and snapshot indexes remain:

- collection runs by `model_id` and `started_at` (newest first)
- snapshots by `model_id`, `period_days`, and `collected_at` (newest first)

## Why this design fits the analyzer

**Raw data first.** Snapshots keep the numbers OnlyFans reported. The app can later subtract, compare, and describe changes in code. AI only explains those already-calculated results.

**Historical comparison.** Because every successful collection is saved, the analyzer can take a current 1, 2, 7, or 30 day snapshot and compare it with an earlier snapshot of the same period length. That is the basis for “up vs down” without derived metric tables.

**Historical manager responsibility.** A model may move from one account manager to another. Without `model_manager_assignments`, older performance could be attributed to whoever currently owns the model. Assignment periods let future reporting answer who managed a model during a particular 1, 2, 7, or 30 day window.

**Simple MVP shape.** Five tables cover managers, models, assignment history, operational collection, and statistics. Splitting earnings, traffic, and messages into separate tables would not make the first reports clearer.

**Failures are visible.** Account managers and operators can see that collection was attempted even when no new numbers arrived. Failed runs do not overwrite or fabricate statistics.

**Safe by default.** Creator identity and AdsPower profile IDs are stored. OnlyFans credentials, sessions, and manager login accounts are not. Error text is stored only as a short, non-sensitive message. Managers with assignment history cannot be deleted.

**Later work stays later.** There is no anomaly table, no custom-metric table, no Social Media Ideas table, and no authentication table. Those features should not be implied by empty placeholder structures.

## Future application behavior

Documented here only. Do not implement these in this documentation step.

The application will later have:

- an Account Managers management page
- Add Account Manager
- deactivate / reactivate manager
- safe permanent delete for unused managers only
- model reassignment
- an active-manager dropdown on the Add Model form
- manager-based model filtering / grouping

## What this schema does not do yet

- It does not create or migrate any database objects by itself.
- It does not calculate 1 / 2 / 7 / 30 day changes. That is application logic after data exists.
- It does not define reports, UI, or the Playwright collection layer.
- It does not store every possible OnlyFans field. Columns can be added to `statistic_snapshots` when a directly available core statistic proves useful.
