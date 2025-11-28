-- Check all sequences in the database for potential sync issues
-- This script identifies sequences where the current value is less than the max ID in the table

DO $$
DECLARE
    r RECORD;
    max_id BIGINT;
    seq_val BIGINT;
BEGIN
    FOR r IN
        SELECT
            schemaname,
            tablename,
            indexname
        FROM pg_indexes
        WHERE indexdef LIKE '%PRIMARY KEY%'
        ORDER BY tablename
    LOOP
        BEGIN
            -- Get the sequence name for this table
            EXECUTE format('SELECT last_value FROM %I', tablename || '_id_seq') INTO seq_val;

            -- Get the max ID from the table
            EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', tablename) INTO max_id;

            -- Report if there's a mismatch
            IF seq_val < max_id THEN
                RAISE NOTICE 'MISMATCH: Table % - Max ID: %, Sequence: %', tablename, max_id, seq_val;
            ELSE
                RAISE NOTICE 'OK: Table % - Max ID: %, Sequence: %', tablename, max_id, seq_val;
            END IF;
        EXCEPTION
            WHEN undefined_table THEN
                NULL; -- Skip if sequence doesn't exist
            WHEN others THEN
                NULL; -- Skip on any error
        END;
    END LOOP;
END$$;
