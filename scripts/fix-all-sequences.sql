-- Fix all sequence sync issues by resetting sequences to match max IDs
-- This prevents unique constraint violations when inserting new records

-- Fix cards sequence
SELECT setval('cards_id_seq', (SELECT COALESCE(MAX(id), 1) FROM cards), true);

-- Fix card_submissions sequence
SELECT setval('card_submissions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM card_submissions), true);

-- Fix tags sequence
SELECT setval('tags_id_seq', (SELECT COALESCE(MAX(id), 1) FROM tags), true);

-- Fix forum_categories sequence
SELECT setval('forum_categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM forum_categories), true);

-- Fix forum_threads sequence
SELECT setval('forum_threads_id_seq', (SELECT COALESCE(MAX(id), 1) FROM forum_threads), true);

-- Fix forum_posts sequence
SELECT setval('forum_posts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM forum_posts), true);

-- Verify all fixes
SELECT 'cards' as table_name,
       (SELECT MAX(id) FROM cards) as max_id,
       (SELECT last_value FROM cards_id_seq) as seq_value
UNION ALL
SELECT 'card_submissions',
       (SELECT MAX(id) FROM card_submissions),
       (SELECT last_value FROM card_submissions_id_seq)
UNION ALL
SELECT 'card_modifications',
       (SELECT MAX(id) FROM card_modifications),
       (SELECT last_value FROM card_modifications_id_seq)
UNION ALL
SELECT 'tags',
       (SELECT MAX(id) FROM tags),
       (SELECT last_value FROM tags_id_seq)
UNION ALL
SELECT 'reviews',
       (SELECT MAX(id) FROM reviews),
       (SELECT last_value FROM reviews_id_seq)
UNION ALL
SELECT 'forum_categories',
       (SELECT MAX(id) FROM forum_categories),
       (SELECT last_value FROM forum_categories_id_seq)
UNION ALL
SELECT 'forum_threads',
       (SELECT MAX(id) FROM forum_threads),
       (SELECT last_value FROM forum_threads_id_seq)
UNION ALL
SELECT 'forum_posts',
       (SELECT MAX(id) FROM forum_posts),
       (SELECT last_value FROM forum_posts_id_seq);
