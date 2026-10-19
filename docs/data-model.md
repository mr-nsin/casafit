# CasaFit · Data model

Logical tables. Field types are sketches; firm up when the service is written. Everything that holds health or identity data has a retention rule on it.

## 1 · Accounts

### `account`

| Column | Type | Note |
|---|---|---|
| `id` | uuid | Primary key. |
| `phone_e164` | text, unique, nullable | Normalised to E.164. Null if the user signed in with email only. |
| `email_norm` | text, unique, nullable | Lower-cased, Gmail dots and plus-tags stripped. |
| `created_at` | timestamptz | |
| `locale` | text | For example `en-IN`, `hi-IN`. |
| `onboarded` | boolean | |

**Normalisation rules.** `phone_e164` is required to be unique after format normalisation. `email_norm` is lower-cased, with `.` removed on Gmail and `+<tag>` stripped. See the duplicate-account rule in `decisions.md`.

### `account_identifier_hash`

Written only when a user deletes their account. Lets us stop the "delete and re-register for new credits" loophole without keeping the raw identifier.

| Column | Type | Note |
|---|---|---|
| `hash` | bytea | HMAC-SHA256 of the normalised identifier with a server-side pepper. |
| `deleted_at` | timestamptz | |
| `expires_at` | timestamptz | Default: deleted_at + 180 days. See `decisions.md`. |

## 2 · Plan and sessions

### `plan`

| Column | Type | Note |
|---|---|---|
| `account_id` | uuid | FK → `account.id`. One active row per account. |
| `goal` | enum | `stay_fit`, `body_part`, `gentler`. |
| `styles` | int bitmask | Normal, yoga, dance. |
| `days_per_week` | smallint | 3..7. |
| `experience` | enum | `new`, `on_and_off`, `regular`. |
| `flags` | jsonb | Pain areas, health flags (`heart_bp`, `pregnancy`, `recent_surgery`). |
| `week_number` | int | Advances automatically. |
| `updated_at` | timestamptz | |

### `session_log`

One row per completed session.

| Column | Type | Note |
|---|---|---|
| `id` | uuid | |
| `account_id` | uuid | |
| `plan_week` | int | |
| `plan_day` | smallint | |
| `style` | enum | `normal`, `yoga`, `dance`. |
| `duration_s` | int | Clamped to 60..3600 for safety. |
| `felt` | enum | `easy`, `about_right`, `hard`. |
| `completed_at` | timestamptz | |

## 3 · Entitlements

### `form_check_balance`

The lifetime free-check counter. One row per account.

| Column | Type | Note |
|---|---|---|
| `account_id` | uuid | PK. |
| `credits_remaining` | smallint | Starts at 2. Never resets. Never goes below zero. |
| `last_consumed_at` | timestamptz | |
| `version` | int | Optimistic lock for `consume` and `refund`. |

### `form_check_event`

Append-only. Lets us audit the balance.

| Column | Type |
|---|---|
| `id` | uuid |
| `account_id` | uuid |
| `kind` | enum `consume`, `refund` |
| `idempotency_key` | text, unique per `(account_id, kind)` |
| `at` | timestamptz |

**Offline rule.** The client caches `credits_remaining`. Spending offline uses the cached value; the next online call `POST /entitlements/consume` runs with the client's idempotency key. If the server balance is already zero, the response is `{ ok: false, reason: "no_credits" }` and the client keeps the result but marks it as "would have been charged." See the offline-spend decision in `decisions.md`.

### `subscription`

| Column | Type | Note |
|---|---|---|
| `account_id` | uuid | PK. |
| `platform` | enum | `play`, `appstore`. |
| `product_id` | text | For example `pro_yearly_v1`. |
| `expires_at` | timestamptz | |
| `last_verified_at` | timestamptz | |

Pro is read from this table; the phone caches the answer for a day.

## 4 · Food and steps

### `food_entry`

| Column | Type | Note |
|---|---|---|
| `id` | uuid | |
| `account_id` | uuid | |
| `logged_on` | date | Local to the user. |
| `meal` | enum | `breakfast`, `lunch`, `snack`, `dinner`, `other`. |
| `food_id` | text | FK → bundled catalogue. |
| `portions` | numeric(5,2) | For example `1.5` katori. |

### `food_catalogue` (bundled, not per-account)

| Column | Type | Note |
|---|---|---|
| `id` | text | For example `dal_tadka_katori`. |
| `name` | text | |
| `portion_name` | text | For example `katori`. |
| `kcal` | int | Per portion. |
| `protein_g` | numeric(4,1) | |
| `source` | text | For example `IFCT 2017 adapted`. |
| `version` | int | Pack version. |

### `step_summary`

| Column | Type | Note |
|---|---|---|
| `account_id` | uuid | |
| `on_date` | date | Local to the user. |
| `steps` | int | |
| `brisk_minutes` | int | |

GPS is never stored. See `decisions.md`.

## 5 · What lives where

| Data | On the phone | On the server |
|---|---|---|
| Phone number or email | Yes (to show) | Yes (identity) |
| Health answers | Yes | Only if the user turns on sync |
| Plan, days, styles | Yes | Yes (metadata) |
| Session logs | Yes | Yes (sync) |
| Food log | Yes | Yes (daily batch sync) |
| Step summaries | Yes | Yes (daily batch sync) |
| Pose frames | In memory only | Never |
| Progress photos (future) | Yes, device biometric lock | Never, unless user turns on backup |
| Free-check balance | Cached | Source of truth |
| Pro state | Cached (daily) | Source of truth |

## 6 · Retention

| Data | Default retention |
|---|---|
| Session, food and step logs | 2 years, then rolled into monthly summaries |
| OTP codes (Redis) | 5 minutes |
| OTP attempt counters | 24 hours |
| Rate-limit counters | 7 days |
| Analytics events | 13 months |
| Deleted-account identifier hashes | 180 days from the deletion time |

## 7 · Export and delete

- **Export my data** returns the account row, plan, food, step and session logs as JSON and CSV, inside a signed URL that expires in 24 hours.
- **Delete my account** sets a `deleted_at` on the account, removes personal rows and writes an `account_identifier_hash` row with the 180-day expiry. The lifetime free-check balance is forgotten by design (see the loophole decision).
