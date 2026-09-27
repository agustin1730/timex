-- One atomic, versioned document per user. Tombstones remain in the document.
create table if not exists public.intervalos_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  library jsonb not null check (
    library->>'schema' = '1' and jsonb_typeof(library->'folders') = 'object'
    and jsonb_typeof(library->'timers') = 'object' and jsonb_typeof(library->'sequences') = 'object'
  ),
  updated_at timestamptz not null default now()
);
alter table public.intervalos_libraries enable row level security;
alter table public.intervalos_libraries force row level security;
create policy "Read own library" on public.intervalos_libraries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own library" on public.intervalos_libraries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own library" on public.intervalos_libraries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.intervalos_libraries from anon;
grant select, insert, update on public.intervalos_libraries to authenticated;
-- No DELETE grant: clients propagate tombstones rather than losing deletion history.
create or replace function public.intervalos_commit(expected_revision bigint, next_library jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.intervalos_libraries;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if octet_length(next_library::text) > 10485760 then raise exception 'Library exceeds 10 MB'; end if;
  if expected_revision = 0 then
    insert into public.intervalos_libraries(user_id, revision, library)
    values(auth.uid(),1,next_library) on conflict (user_id) do nothing returning * into saved;
  else
    update public.intervalos_libraries set library=next_library, revision=revision+1, updated_at=now()
    where user_id=auth.uid() and revision=expected_revision returning * into saved;
  end if;
  if saved.user_id is null then return null; end if;
  return jsonb_build_object('revision',saved.revision,'library',saved.library);
end $$;
revoke all on function public.intervalos_commit(bigint,jsonb) from public, anon;
grant execute on function public.intervalos_commit(bigint,jsonb) to authenticated;
