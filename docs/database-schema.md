# MVP Database Schema

This document describes the initial Neon PostgreSQL structure for the Account Performance Analyzer.

It is a design only. Tables have not been created. This is not a migration and does not include executable SQL.

The MVP stores **raw OnlyFans statistics** as historical snapshots. Application logic will later compare those snapshots for 1, 2, 7, and 30 day periods. AI will explain already-calculated findings. It will not invent metrics or perform the important numerical comparisons.

Out of scope for this schema:

- Derived or custom metrics that OnlyFans does not directly provide
- Anomaly detection or any placeholder for it
- Social Media Ideas / Content Assistant tables
- OnlyFans passwords, session tokens, cookies, or other login credentials

AdsPower profile IDs are allowed and are stored on each model.

## Design summary

Three tables:

1. `models` — the creators we manage
2. `statistic_collection_runs` — every automation attempt to collect statistics
3. `statistic_snapshots` — the raw OnlyFans numbers collected for a specific model and date range

This is enough for the MVP. Extra tables per metric area (earnings, traffic, messages, and so on) would add complexity without helping the first analyzer.

```text
models
  1 ──< statistic_collection_runs
          1 ──< statistic_snapshots
```

A model has many collection runs. A successful run stores one snapshot per collected period (1, 2, 7, and 30 days). A failed run stores no snapshots and keeps a safe error message instead.

## 1. `models`

**Purpose:** One row per creator account the team manages.

This is the stable identity the rest of the app hangs off. Automation will later open the matching AdsPower profile and collect OnlyFans statistics for that model.

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

## 2. `statistic_collection_runs`

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

### Relationship

- Many collection runs belong to one model.
- Deleting a model later would also remove its runs and snapshots. The MVP does not need a special archive table for this.

## 3. `statistic_snapshots`

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

- **`models.id` → `statistic_collection_runs.model_id`**  
  Each run is for exactly one model. A model can have many runs over time.

- **`statistic_collection_runs.id` → `statistic_snapshots.collection_run_id`**  
  Snapshots are produced by a successful run. A failed run has zero snapshots.

- **`models.id` → `statistic_snapshots.model_id`**  
  Each snapshot belongs to one model. This supports queries such as “all 7-day snapshots for this model, newest first”.

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

## Why this design fits the analyzer

**Raw data first.** Snapshots keep the numbers OnlyFans reported. The app can later subtract, compare, and describe changes in code. AI only explains those already-calculated results.

**Historical comparison.** Because every successful collection is saved, the analyzer can take a current 1, 2, 7, or 30 day snapshot and compare it with an earlier snapshot of the same period length. That is the basis for “up vs down” without derived metric tables.

**Simple MVP shape.** Three tables cover models, operational collection, and statistics. Splitting earnings, traffic, and messages into separate tables would not make the first reports clearer.

**Failures are visible.** Account managers and operators can see that collection was attempted even when no new numbers arrived. Failed runs do not overwrite or fabricate statistics.

**Safe by default.** Creator identity and AdsPower profile IDs are stored. OnlyFans credentials and sessions are not. Error text is stored only as a short, non-sensitive message.

**Later work stays later.** There is no anomaly table, no custom-metric table, and no Social Media Ideas table. Those features should not be implied by empty placeholder structures.

## What this schema does not do yet

- It does not create or migrate any database objects.
- It does not calculate 1 / 2 / 7 / 30 day changes. That is application logic after data exists.
- It does not define reports, UI, or the Playwright collection layer.
- It does not store every possible OnlyFans field. Columns can be added to `statistic_snapshots` when a directly available core statistic proves useful.
