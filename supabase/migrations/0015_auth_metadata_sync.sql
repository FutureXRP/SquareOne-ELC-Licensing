-- 0015_auth_metadata_sync.sql
-- Supabase Auth creates a user row first and writes app_metadata in a second statement,
-- so the insert trigger from 0002 never sees the role an invitation carries. This trigger
-- applies the role the FIRST time app_metadata gains one. After that the profiles table is
-- the source of truth: later metadata changes never re-activate or re-role a profile.
-- app_metadata is writable only with the service role; user_metadata is never read.

create function public.handle_user_role_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text := new.raw_app_meta_data ->> 'role';
begin
  if (old.raw_app_meta_data ->> 'role') is null
     and new_role in ('director', 'admin_support', 'educator', 'classroom_reviewer', 'auditor') then
    update public.profiles p
       set role = new_role::public.app_role,
           is_active = true,
           display_name = coalesce(p.display_name, new.raw_app_meta_data ->> 'display_name'),
           email = coalesce(new.email, p.email)
     where p.id = new.id
       and not p.is_active
       and p.archived_at is null;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_role_assigned() from authenticated;

create trigger on_auth_user_role_assigned after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_role_assigned();
