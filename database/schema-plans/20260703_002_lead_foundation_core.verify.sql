-- VALIDATION ONLY — run against the isolated Neon rehearsal branch after the proposed core SQL.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('LeadContact', 'LeadImportKey', 'LeadImportBatch', 'LeadImportRecord', 'LeadImportRequest')
ORDER BY table_name;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Lead'
  AND column_name = 'businessPhone';

SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('LeadContact', 'LeadImportBatch', 'LeadImportRecord', 'LeadImportRequest')
ORDER BY tc.table_name, kcu.column_name;

SELECT id, description, notes
FROM "_mcd_schema_migrations"
WHERE id = '20260703_002_lead_foundation_core';
