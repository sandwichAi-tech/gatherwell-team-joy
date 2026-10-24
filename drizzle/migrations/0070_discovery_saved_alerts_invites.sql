-- Saved offerings (events + learning) per signed-in user
create table public.saved_offerings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('event','offer')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target_id)
);
grant select, insert, delete on public.saved_offerings to authenticated;
grant all on public.saved_offerings to service_role;
alter table public.saved_offerings enable row level security;
create policy "People manage their own saved items" on public.saved_offerings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Coarse location alerts; in-app matching only, no provider delivery
create table public.location_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text,
  city text,
  region text,
  country text,
  lat double precision,
  lng double precision,
  radius_km int not null default 50 check (radius_km between 5 and 500),
  categories text[] not null default '{}',
  kinds text[] not null default '{}',
  language text,
  frequency text not null default 'weekly' check (frequency in ('instant','daily','weekly')),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.location_alerts to authenticated;
grant all on public.location_alerts to service_role;
alter table public.location_alerts enable row level security;
create policy "People manage their own alerts" on public.location_alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Invite-a-host attribution; no direct client access, RPC only
create table public.host_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  inviter_id uuid,
  created_at timestamptz not null default now(),
  signed_up_user_id uuid,
  recorded_at timestamptz
);
grant all on public.host_invites to service_role;
alter table public.host_invites enable row level security;

create or replace function public.create_host_invite()
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  t := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.host_invites (token, inviter_id) values (t, auth.uid());
  return t;
end $$;

-- Idempotent; rejects self-referral; records at most once per token
create or replace function public.record_host_invite(_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare inv public.host_invites%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into inv from public.host_invites where token = upper(trim(_token)) for update;
  if not found then return false; end if;
  if inv.recorded_at is not null then return true; end if; -- idempotent
  if inv.inviter_id = auth.uid() then return false; end if; -- no self-referral
  update public.host_invites set signed_up_user_id = auth.uid(), recorded_at = now() where id = inv.id;
  return true;
end $$;

-- Unified public discovery catalog: real published public offerings only.
-- Never returns samples, drafts, archived, cancelled, or invite/team-only rows.
create or replace function public.discover_catalog(
  _q text default null,
  _kinds text[] default null,        -- event, course, download, membership
  _cat text default null,
  _from timestamptz default null,
  _to timestamptz default null,
  _format text default null,         -- person, online, hybrid
  _free boolean default null,
  _lang text default null,
  _accessible boolean default false,
  _minors boolean default false,
  _lat double precision default null,
  _lng double precision default null,
  _radius_km int default null,
  _sort text default 'soonest'       -- soonest, newest, relevant
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  with ev as (
    select e.id, 'event'::text as kind, e.title, coalesce(e.summary_en, '') as summary,
           e.category, e.tags, e.starts_at, e.timezone, e.format,
           e.price_cents, e.language, e.accessibility_notes, e.min_age,
           e.location_name, e.lat, e.lng, e.created_at, e.host_id,
           case when _lat is not null and e.lat is not null then
             6371 * 2 * asin(sqrt(power(sin(radians(e.lat - _lat) / 2), 2) + cos(radians(_lat)) * cos(radians(e.lat)) * power(sin(radians(e.lng - _lng) / 2), 2)))
           end as distance_km
    from events e
    where e.status = 'published' and e.visibility = 'public'
      and e.starts_at > now() - interval '1 day'
      and (_kinds is null or 'event' = any(_kinds))
      and (_q is null or e.title ilike '%' || _q || '%' or coalesce(e.summary_en,'') ilike '%' || _q || '%' or coalesce(e.summary_es,'') ilike '%' || _q || '%')
      and (_cat is null or e.category = _cat or _cat = any(e.tags))
      and (_from is null or e.starts_at >= _from)
      and (_to is null or e.starts_at <= _to)
      and (_format is null or e.format = _format)
      and (_free is null or (_free and coalesce(e.price_cents,0) = 0) or (not _free and coalesce(e.price_cents,0) > 0))
      and (_lang is null or e.language = _lang)
      and (not _accessible or nullif(trim(coalesce(e.accessibility_notes,'')), '') is not null)
      and (not _minors or e.min_age is null or e.min_age < 18)
  ), ofr as (
    select o.id, o.kind, coalesce(o.title_en, '') as title, coalesce(o.summary_en, '') as summary,
           o.category, o.tags, null::timestamptz as starts_at, null::text as timezone, 'online'::text as format,
           o.price_cents, null::text as language, null::text as accessibility_notes, null::int as min_age,
           null::text as location_name, null::float8 as lat, null::float8 as lng, o.created_at, o.host_id,
           null::float8 as distance_km
    from offers o
    where o.status = 'published' and o.visibility = 'public'
      and (_kinds is null or o.kind = any(_kinds))
      and (_q is null or o.title_en ilike '%' || _q || '%' or o.title_es ilike '%' || _q || '%' or coalesce(o.summary_en,'') ilike '%' || _q || '%')
      and (_cat is null or o.category = _cat or _cat = any(o.tags))
      and (_from is null and _to is null) -- evergreen: no date window
      and (_format is null or _format = 'online')
      and (_free is null or (_free and coalesce(o.price_cents,0) = 0) or (not _free and coalesce(o.price_cents,0) > 0))
      and _lang is null -- offers carry no language field yet
      and not _accessible and not _minors -- no such metadata on offers yet
  ), combined as (
    select * from ev where (_lat is null or _radius_km is null or (distance_km is not null and distance_km <= _radius_km))
    union all
    select * from ofr where _lat is null -- location filter shows in-person only; online learning listed separately
  )
  select coalesce(jsonb_agg(row_to_json(x)::jsonb - 'lat' - 'lng' - 'host_id'
    || jsonb_build_object('host_name', p.full_name, 'host_slug', p.slug,
                          'url', case when x.kind = 'event' then '/e/' || x.id else '/o/' || x.id end)
    order by case when _sort = 'newest' then extract(epoch from x.created_at) end desc nulls last,
             case when _sort = 'relevant' and _q is not null then (x.title ilike '%' || _q || '%')::int end desc nulls last,
             x.starts_at asc nulls last, x.created_at desc), '[]'::jsonb)
  into result
  from combined x left join profiles p on p.user_id = x.host_id;
  return result;
end $$;

-- In-app alert matches: new (last 30 days) published public offerings matching each active alert
create or replace function public.my_alert_matches()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(distinct jsonb_build_object('alert_id', a.id, 'alert_label', coalesce(a.label, a.city, ''), 'offering', m.item)), '[]'::jsonb)
    from public.location_alerts a
    cross join lateral (
      select item from (
        select jsonb_build_object('kind','event','id',e.id,'title',e.title,'starts_at',e.starts_at,'url','/e/'||e.id,'location_name',e.location_name) as item
        from events e
        where e.status='published' and e.visibility='public' and e.created_at > now() - interval '30 days'
          and (a.kinds = '{}' or 'event' = any(a.kinds))
          and (a.categories = '{}' or e.category = any(a.categories))
          and (a.language is null or e.language = a.language)
          and (a.lat is null or (e.lat is not null and 6371 * 2 * asin(sqrt(power(sin(radians(e.lat - a.lat) / 2), 2) + cos(radians(a.lat)) * cos(radians(e.lat)) * power(sin(radians(e.lng - a.lng) / 2), 2))) <= a.radius_km))
        union all
        select jsonb_build_object('kind',o.kind,'id',o.id,'title',o.title_en,'starts_at',null,'url','/o/'||o.id,'location_name',null)
        from offers o
        where o.status='published' and o.visibility='public' and o.created_at > now() - interval '30 days'
          and (a.kinds = '{}' or o.kind = any(a.kinds))
          and (a.categories = '{}' or o.category = any(a.categories))
          and a.language is null and a.lat is null
      ) items
    ) m
    where a.user_id = auth.uid() and not a.paused
  );
end $$;