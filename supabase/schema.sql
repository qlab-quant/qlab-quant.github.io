-- ─────────────────────────────────────────────────────────────
-- Q-Lab 갤러리 데이터베이스
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run 하세요. (처음 한 번만)
--
-- 규칙
--   · 누구나 글과 댓글을 읽을 수 있다
--   · 가입하면 '승인 대기'가 되고, 운영진(admin)이 승인해야 글 · 댓글 · 추천 · 사진 올리기가 된다
--   · 글과 댓글은 쓴 사람만 고치고, 쓴 사람이나 운영진이 지울 수 있다
--   · 회원 승인 · 운영진 지정은 운영진만 할 수 있다
-- ─────────────────────────────────────────────────────────────

-- 회원 (가입하면 자동으로 한 줄 생긴다)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);
create unique index profiles_nickname_unique on public.profiles (lower(nickname));

-- 가입 메시지 (본인과 운영진만 볼 수 있다)
create table public.join_requests (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 300),
  created_at timestamptz not null default now()
);

create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 20000),
  images text[] not null default '{}' check (cardinality(images) <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index posts_author_idx on public.posts (author_id);

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id);

create table public.post_likes (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 목록용: 글마다 글쓴이 닉네임, 사진 여부, 댓글 수, 추천 수를 함께 보여 준다
create view public.post_list with (security_invoker = true) as
select
  p.id,
  p.title,
  p.created_at,
  p.author_id,
  pr.nickname as author_nickname,
  cardinality(p.images) > 0 as has_images,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count,
  (select count(*) from public.post_likes l where l.post_id = p.id) as like_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;
grant select on public.post_list to anon, authenticated;

-- ── 권한 확인 함수 ──
create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved' and role = 'admin');
$$;

-- 가입 전에 닉네임이 비어 있는지 확인 (로그인 안 해도 쓸 수 있다)
create function public.nickname_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where lower(nickname) = lower(trim(name)));
$$;
grant execute on function public.nickname_available(text) to anon, authenticated;

-- ── 가입하면 회원 정보와 가입 메시지를 만든다 ──
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nickname)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), '회원' || left(new.id::text, 6)));
  insert into join_requests (user_id, message)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'message', ''), 300));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 운영진이 아니면 자기 승인 상태 · 역할을 못 바꾸게 막는다 ──
-- (SQL Editor처럼 로그인 사용자가 없는 곳에서는 바꿀 수 있다: 첫 운영진 지정용)
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.status := old.status;
    new.role := old.role;
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 글을 고치면 글쓴이 · 작성 시각은 그대로, 수정 시각은 지금으로
create function public.guard_post_update() returns trigger
language plpgsql as $$
begin
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger guard_post_update
  before update on public.posts
  for each row execute function public.guard_post_update();

-- ── 보안 정책 (Row Level Security) ──
alter table public.profiles enable row level security;
alter table public.join_requests enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;

create policy "누구나 닉네임을 볼 수 있다" on public.profiles
  for select using (true);
create policy "본인 정보 수정" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "운영진은 회원 정보 수정" on public.profiles
  for update using (public.is_admin());

create policy "가입 메시지는 본인과 운영진만" on public.join_requests
  for select using (user_id = auth.uid() or public.is_admin());

create policy "누구나 글을 읽는다" on public.posts
  for select using (true);
create policy "승인된 회원만 글쓰기" on public.posts
  for insert with check (author_id = auth.uid() and public.is_approved());
create policy "본인 글만 수정" on public.posts
  for update using (author_id = auth.uid() and public.is_approved()) with check (author_id = auth.uid());
create policy "본인 또는 운영진이 글 삭제" on public.posts
  for delete using (author_id = auth.uid() or public.is_admin());

create policy "누구나 댓글을 읽는다" on public.comments
  for select using (true);
create policy "승인된 회원만 댓글" on public.comments
  for insert with check (author_id = auth.uid() and public.is_approved());
create policy "본인 또는 운영진이 댓글 삭제" on public.comments
  for delete using (author_id = auth.uid() or public.is_admin());

create policy "누구나 추천 수를 본다" on public.post_likes
  for select using (true);
create policy "승인된 회원만 추천" on public.post_likes
  for insert with check (user_id = auth.uid() and public.is_approved());
create policy "본인 추천 취소" on public.post_likes
  for delete using (user_id = auth.uid());

-- ── 사진 저장소: 누구나 보고, 승인된 회원은 자기 폴더에만 올린다 (5MB, 사진만) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

create policy "갤러리 사진은 누구나 본다" on storage.objects
  for select using (bucket_id = 'gallery');
create policy "승인된 회원은 자기 폴더에 사진 올리기" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery' and public.is_approved() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "본인 또는 운영진이 사진 삭제" on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ─────────────────────────────────────────────────────────────
-- 첫 운영진 지정: 사이트에서 회원가입한 다음, 닉네임을 바꿔서 아래 한 줄만 따로 실행하세요.
--   update public.profiles set status = 'approved', role = 'admin' where nickname = '내닉네임';
-- ─────────────────────────────────────────────────────────────
