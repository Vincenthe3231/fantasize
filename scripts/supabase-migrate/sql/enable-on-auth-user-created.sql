-- Target DB: restore trigger after auth + public.profiles are loaded.
alter table auth.users enable trigger on_auth_user_created;
