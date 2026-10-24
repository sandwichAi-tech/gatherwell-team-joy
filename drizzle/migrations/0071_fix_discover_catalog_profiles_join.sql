-- profiles is keyed by id, not user_id
create or replace function public.discover_catalog(
  _q text default null,
  _kinds text[] default null,
  _cat text default null,
  _from timestamptz default null,
  _to timestamptz default null,
  _format text default null,
  _free boolean default null,
  _lang text default null,
  _accessible boolean default false,
  _minors boolean default false,
  _lat double precision default null,
  _lng double precision default null,
  _radius_km int default null,
  _sort text default 'soonest'
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
      and (_from is null and _to is null)
      and (_format is null or _format = 'online')
      and (_free is null or (_free and coalesce(o.price_cents,0) = 0) or (not _free and coalesce(o.price_cents,0) > 0))
      and _lang is null
      and not _accessible and not _minors
  ), combined as (
    select * from ev where (_lat is null or _radius_km is null or (distance_km is not null and distance_km <= _radius_km))
    union all
    select * from ofr where _lat is null
  )
  select coalesce(jsonb_agg(row_to_json(x)::jsonb - 'lat' - 'lng' - 'host_id'
    || jsonb_build_object('host_name', p.full_name, 'host_slug', p.slug,
                          'url', case when x.kind = 'event' then '/e/' || x.id else '/o/' || x.id end)
    order by case when _sort = 'newest' then extract(epoch from x.created_at) end desc nulls last,
             case when _sort = 'relevant' and _q is not null then (x.title ilike '%' || _q || '%')::int end desc nulls last,
             x.starts_at asc nulls last, x.created_at desc), '[]'::jsonb)
  into result
  from combined x left join profiles p on p.id = x.host_id;
  return result;
end $$;