-- Check all key tables for sequence sync issues
SELECT 'users' as table_name,
       (SELECT MAX(id) FROM users) as max_id,
       (SELECT last_value FROM users_id_seq) as seq_value
UNION ALL
SELECT 'cards',
       (SELECT MAX(id) FROM cards),
       (SELECT last_value FROM cards_id_seq)
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
