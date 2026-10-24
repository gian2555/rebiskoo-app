-- ReceiptSafe: run this whole file once in Supabase -> SQL Editor.

-- ---------- Tables ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  student_id  text unique,
  full_name   text not null default '',
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.receipts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  description  text not null check (char_length(description) between 1 and 120),
  amount       numeric(10,2) not null check (amount > 0),
  paid_on      date not null,
  category     text not null,
  receipt_no   text,
  notes        text,
  image_path   text,
  status       text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note  text,
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists receipts_user_idx   on public.receipts (user_id, paid_on desc);
create index if not exists receipts_status_idx on public.receipts (status, paid_on desc);

-- ---------- Helpers ----------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile row whenever someone signs up. The role is never taken from sign-up data.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, student_id, full_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    coalesce(trim(new.raw_user_meta_data ->> 'full_name'), '')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Students cannot change who owns a receipt or fake a review. Any student edit sends it back to "pending".
create or replace function public.receipts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if public.is_admin() then
    if new.status is distinct from old.status then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;
  new.user_id     := old.user_id;
  new.status      := 'pending';
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end $$;

drop trigger if exists receipts_guard_trg on public.receipts;
create trigger receipts_guard_trg
  before update on public.receipts
  for each row execute function public.receipts_guard();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.receipts enable row level security;

-- profiles: see your own (admins see all); you can only change your own full_name
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant  update (full_name) on public.profiles to authenticated;

-- receipts
drop policy if exists "receipts read"           on public.receipts;
drop policy if exists "receipts insert own"     on public.receipts;
drop policy if exists "receipts update own"     on public.receipts;
drop policy if exists "receipts update admin"   on public.receipts;
drop policy if exists "receipts delete own"     on public.receipts;

create policy "receipts read" on public.receipts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "receipts insert own" on public.receipts for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- a student can edit or delete their own receipt until it has been verified
create policy "receipts update own" on public.receipts for update to authenticated
  using (user_id = auth.uid() and status <> 'verified')
  with check (user_id = auth.uid());

create policy "receipts update admin" on public.receipts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "receipts delete own" on public.receipts for delete to authenticated
  using (user_id = auth.uid() and status <> 'verified');

-- ---------- Storage (private bucket for receipt photos) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "receipt files read"   on storage.objects;
drop policy if exists "receipt files insert" on storage.objects;
drop policy if exists "receipt files delete" on storage.objects;

-- files live at <user id>/<file name>
create policy "receipt files read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "receipt files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipt files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Make someone an admin (run by you, after they have registered) ----------
-- update public.profiles set role = 'admin' where student_id = 'CASHIER-01';
