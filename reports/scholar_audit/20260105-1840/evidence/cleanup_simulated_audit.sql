-- Cleanup script for simulated_audit namespace
-- TTL: 14 days

DELETE FROM events 
WHERE payload->>'namespace' = 'simulated_audit'
  AND created_at < NOW() - INTERVAL '14 days';

-- Verify cleanup
SELECT COUNT(*) as remaining 
FROM events 
WHERE payload->>'namespace' = 'simulated_audit';
