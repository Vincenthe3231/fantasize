-- Dev seed: superadmin@example.com + transfer ownership of a fixed space id.
-- Idempotent: updates password if user exists; ensures email identity + profile row.

create extension if not exists pgcrypto;

do $$
declare
  v_admin_id uuid;
  v_space_id uuid := '576da855-e0b5-4074-bdc3-301b42de2d3e';
  v_email text := 'superadmin@example.com';
  v_pw text := 'password';
  v_encrypted_pw text;
begin
  if not exists (select 1 from public.spaces where id = v_space_id) then
    raise exception 'space % not found; cannot bind owner', v_space_id;
  end if;

  select id into v_admin_id from auth.users where email = v_email limit 1;

  v_encrypted_pw := extensions.crypt(v_pw, extensions.gen_salt('bf'));

  if v_admin_id is null then
    v_admin_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_pw,
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('display_name', 'Superadmin'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_admin_id,
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
      'email',
      v_admin_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.users
    set
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    where id = v_admin_id;
  end if;

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    v_admin_id,
    jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
    'email',
    v_admin_id::text,
    now(),
    now(),
    now()
  where not exists (
    select 1 from auth.identities i where i.user_id = v_admin_id and i.provider = 'email'
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (v_admin_id, split_part(v_email, '@', 1), null)
  on conflict (id) do nothing;

  update public.spaces
  set owner_id = v_admin_id
  where id = v_space_id;

  if not found then
    raise exception 'space % update failed unexpectedly', v_space_id;
  end if;
end $$;
