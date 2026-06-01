#!/bin/sh
# Merge one Clerk user into another, repointing all ownership + membership.
# Use at a Clerk dev -> prod cutover: after the user signs in on prod (creating
# a NEW users row with the same email but a new id), fold the OLD id into it.
#
#   sh merge-user.sh <OLD_ID> <NEW_ID>
#
# Find the ids: docker exec server-postgres-1 psql -U slate -d slate \
#   -c "SELECT id,email,updated_at FROM users ORDER BY updated_at;"
set -e
OLD="$1"; NEW="$2"
[ -z "$OLD" ] || [ -z "$NEW" ] && { echo "usage: sh merge-user.sh <OLD_ID> <NEW_ID>"; exit 1; }
[ "$OLD" = "$NEW" ] && { echo "OLD and NEW are the same"; exit 1; }

docker exec -i server-postgres-1 psql -U slate -d slate <<SQL
BEGIN;
UPDATE boards SET owner_id='$NEW' WHERE owner_id='$OLD';
UPDATE teams  SET owner_id='$NEW' WHERE owner_id='$OLD';

-- board_members PK is (board_id,user_id): only move rows where NEW isn't already a member
UPDATE board_members bm SET user_id='$NEW'
 WHERE bm.user_id='$OLD'
   AND NOT EXISTS (SELECT 1 FROM board_members x WHERE x.board_id=bm.board_id AND x.user_id='$NEW');
DELETE FROM board_members WHERE user_id='$OLD';

UPDATE team_members tm SET user_id='$NEW'
 WHERE tm.user_id='$OLD'
   AND NOT EXISTS (SELECT 1 FROM team_members x WHERE x.team_id=tm.team_id AND x.user_id='$NEW');
DELETE FROM team_members WHERE user_id='$OLD';

-- invited_by FKs are ON DELETE SET NULL, so the old row can go
DELETE FROM users WHERE id='$OLD';
COMMIT;
SELECT '$OLD merged into $NEW' AS done;
SQL
