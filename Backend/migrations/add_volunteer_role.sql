-- Promote non-team account responders (approved volunteers) to volunteer role.
-- Team-rostered personnel stay users.role = 'responder'.

UPDATE users
   SET role = 'volunteer'
 WHERE LOWER(role) = 'responder'
   AND user_id NOT IN (
     SELECT r.user_id
       FROM responders r
       JOIN responder_team_members rtm
         ON rtm.responder_id = r.responder_id
        AND rtm.is_active = TRUE
      WHERE r.user_id IS NOT NULL
   );
