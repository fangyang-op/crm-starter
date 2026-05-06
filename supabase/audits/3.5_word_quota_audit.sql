-- ============================================================================
-- Phase 3.5 word quota audit script
-- ============================================================================
-- Run these queries in Supabase Dashboard SQL Editor whenever you suspect
-- ledger drift. None of them mutate data; they only report.
--
-- Expected:
--   Query 1 → 0 rows  (every student's running balance equals SUM(amount))
--   Query 2 → 0 rows  (every billable version has a matching ledger row)
--   Query 3 → 0 rows  (no ledger row points to a non-existent version)
--   Query 4 → 0 rows  (no negative balance ever)
-- ============================================================================

-- 1. Per-student integrity: latest balance_after MUST equal SUM(amount).
--    A non-zero diff means the trigger or a manual write got out of sync.
WITH per_student AS (
  SELECT
    student_id,
    SUM(amount) AS sum_amount,
    (
      SELECT balance_after
      FROM word_quota_ledger w2
      WHERE w2.student_id = w1.student_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) AS latest_balance
  FROM word_quota_ledger w1
  GROUP BY student_id
)
SELECT student_id, sum_amount, latest_balance, latest_balance - sum_amount AS drift
FROM per_student
WHERE sum_amount IS DISTINCT FROM latest_balance
ORDER BY drift DESC;

-- 2. Coverage: every master version with word_diff_from_previous > 0 must
--    correspond to exactly one 'used' ledger row pointing back at it.
SELECT mv.id AS missing_master_version_id, mv.master_id, mv.version_number,
       mv.word_diff_from_previous, mv.created_at
FROM documents_master_versions mv
LEFT JOIN word_quota_ledger l
  ON l.related_master_version_id = mv.id AND l.transaction_type = 'used'
WHERE mv.word_diff_from_previous > 0
  AND l.id IS NULL
ORDER BY mv.created_at DESC;

-- 2b. Same for variant versions.
SELECT vv.id AS missing_variant_version_id, vv.variant_id, vv.version_number,
       vv.word_diff_from_previous, vv.created_at
FROM documents_variant_versions vv
LEFT JOIN word_quota_ledger l
  ON l.related_variant_version_id = vv.id AND l.transaction_type = 'used'
WHERE vv.word_diff_from_previous > 0
  AND l.id IS NULL
ORDER BY vv.created_at DESC;

-- 3. Reverse coverage: every ledger 'used' row must point to a real version.
--    Catches dangling pointers from manual cleanup.
SELECT l.id, l.student_id, l.amount, l.description, l.created_at,
       l.related_master_version_id, l.related_variant_version_id
FROM word_quota_ledger l
LEFT JOIN documents_master_versions mv ON mv.id = l.related_master_version_id
LEFT JOIN documents_variant_versions vv ON vv.id = l.related_variant_version_id
WHERE l.transaction_type = 'used'
  AND (
    (l.related_master_version_id IS NOT NULL AND mv.id IS NULL)
    OR (l.related_variant_version_id IS NOT NULL AND vv.id IS NULL)
    OR (l.related_master_version_id IS NULL AND l.related_variant_version_id IS NULL)
  )
ORDER BY l.created_at DESC;

-- 4. Sanity: no balance should ever be negative after the v2 trigger lands.
--    Pre-existing negatives (from before 0017) will surface here — investigate
--    and adjust manually before relying on the new guard.
SELECT student_id, MIN(balance_after) AS min_balance, COUNT(*) AS negative_rows
FROM word_quota_ledger
WHERE balance_after < 0
GROUP BY student_id
ORDER BY min_balance ASC;
