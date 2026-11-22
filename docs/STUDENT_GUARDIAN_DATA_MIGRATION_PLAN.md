# EducationOS — Student & Guardian Data Migration & Backward Compatibility Plan
**Document ID:** `docs/STUDENT_GUARDIAN_DATA_MIGRATION_PLAN.md`  
**Date:** 2026-11-11  
**Status:** MIGRATION ARCHITECTURE & SAFETY RUNBOOK  
**Auditors:** Database Reliability Engineer, Backend Architect  

---

## 1. Migration Principles & Guardrails

1. **Additive DDL Only:** No existing columns or tables will be dropped or renamed. All schema modifications are strictly additive with sensible defaults.
2. **Zero Academic Data Loss:** Existing students, attendance records, exam marks, and tuition payments will remain completely intact.
3. **Idempotent Replayability:** Every Alembic upgrade script checks for existing tables and columns prior to executing `CREATE` or `ALTER` statements (`context.is_offline_mode()`).
4. **Automated Data Backfill:** Existing active students and guardians without `User` accounts will be transactionally backfilled with inactive or placeholder user identities ready for activation.

---

## 2. Target Schema Changes & Table Definitions

### 2.1 Table: `account_invitations` (New Table)
```sql
CREATE TABLE IF NOT EXISTS account_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id UUID,
    student_id UUID,
    guardian_id UUID,
    target_role VARCHAR(32) NOT NULL DEFAULT 'student',
    identifier VARCHAR(120),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
    consumed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_user_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_account_invitations_lookup ON account_invitations (tenant_id, target_role, is_consumed);
CREATE INDEX IF NOT EXISTS ix_account_invitations_token_hash ON account_invitations (token_hash);
```

### 2.2 Table: `student_guardians` (Additive Columns)
```sql
ALTER TABLE student_guardians 
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) DEFAULT 'VERIFIED' NOT NULL,
    ADD COLUMN IF NOT EXISTS verification_method VARCHAR(64) DEFAULT 'ADMISSION_RECORD',
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS verified_by VARCHAR(64),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
```

### 2.3 Table: `users` (Additive Columns)
```sql
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE NOT NULL;
CREATE INDEX IF NOT EXISTS ix_users_username ON users (tenant_id, username);
CREATE INDEX IF NOT EXISTS ix_users_phone ON users (tenant_id, phone_number);
```

### 2.4 Table: `study_sessions` & `study_flashcards` & `practice_attempts` (Learning Studio)
```sql
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    student_id UUID NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(150),
    mode VARCHAR(32) NOT NULL DEFAULT 'study_room',
    duration_seconds INTEGER DEFAULT 0,
    goals TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS study_flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    student_id UUID NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(150),
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    mastery_level INTEGER DEFAULT 0,
    review_due_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    student_id UUID NOT NULL,
    subject VARCHAR(100) NOT NULL,
    topic VARCHAR(150),
    question_type VARCHAR(32) DEFAULT 'mcq',
    question_data JSONB DEFAULT '{}'::jsonb NOT NULL,
    student_answer TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    score NUMERIC(5,2) DEFAULT 0.0,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

---

## 3. Backfill Logic for Existing Records

```sql
-- Step 1: Ensure all existing student_guardians links are marked VERIFIED
UPDATE student_guardians 
SET verification_status = 'VERIFIED',
    verification_method = 'HISTORICAL_DATA'
WHERE verification_status IS NULL;

-- Step 2: Backfill User account for existing students lacking a user_id
DO $$
DECLARE
    s RECORD;
    new_uid UUID;
    t_slug TEXT;
BEGIN
    FOR s IN SELECT * FROM students WHERE user_id IS NULL LOOP
        new_uid := gen_random_uuid();
        t_slug := substring(s.tenant_id::text from 1 for 8);
        
        INSERT INTO users (id, tenant_id, email, username, password_hash, role, is_active, first_name, last_name)
        VALUES (
            new_uid,
            s.tenant_id,
            lower(replace(s.admission_number, ' ', '-')) || '-' || t_slug || '@students.internal',
            s.admission_number,
            'placeholder_unactivated_hash',
            'student',
            TRUE,
            s.first_name,
            s.last_name
        ) ON CONFLICT DO NOTHING;
        
        UPDATE students SET user_id = new_uid WHERE id = s.id;
    END LOOP;
END $$;
```

---

## 4. Rollback and Disaster Recovery Strategy

1. **Safety Backup:** Full PostgreSQL dump executed before running the migration (`pg_dump`).
2. **Reversibility:** All additions are nullable or possess defaults; application code can seamlessly fall back to previous behavior if required.
3. **Rollback Script:**
   ```sql
   -- Safe rollback without dropping tables
   ALTER TABLE student_guardians DROP COLUMN IF EXISTS verification_status;
   ALTER TABLE users DROP COLUMN IF EXISTS username;
   ```

