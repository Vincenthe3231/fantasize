-- Target DB: point all users at this project's auth instance.
-- Run: psql "$DATABASE_URL_TARGET" -v ON_ERROR_STOP=1 -v new_instance_id='UUID' -f this_file
-- UUID from: select id from auth.instances limit 1;

update auth.users
set instance_id = :'new_instance_id'::uuid
where instance_id is distinct from :'new_instance_id'::uuid;
