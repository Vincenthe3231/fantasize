-- Target DB: stop auto-insert into public.profiles while bulk-loading auth.users + profiles.
alter table auth.users disable trigger on_auth_user_created;
