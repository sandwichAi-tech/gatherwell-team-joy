-- Discover: cover fields + bounded results, public coach directory, server-only cover validator

-- 1) discover_catalog: add cover fields and limit/offset (parameter list changes, so replace)
DROP FUNCTION public.discover_catalog;
CREATE FUNCTION public.discover_catalog(
  _q text DEFAULT NULL, _kinds text[] DEFAULT NULL, _cat text DEFAULT NULL,
  _from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL,
  _format text DEFAULT NULL, _free boolean DEFAULT NULL, _lang text DEFAULT NULL,
  _accessible boolean DEFAULT false, _minors boolean DEFAULT false,
  _lat float8 DEFAULT NULL, _lng float8 DEFAULT NULL, _radius_km int DEFAULT NULL,
  _sort text DEFAULT 'soonest', _limit int DEFAULT 48, _offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare result jsonb;
begin
  with ev as (
    select e.id, 'event'::text as kind, e.title, coalesce(e.summary_en, '') as summary,
           e.category, e.tags, e.starts_at, e.timezone, e.format,
           e.price_cents, e.language, e.accessibility_notes, e.min_age,
           e.location_name, e.lat, e.lng, e.created_at, e.host_id,
           e.cover_url as cover_path, e.cover_style, e.cover_focal, e.cover_alt, e.cover_overlay,
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
           o.cover_url as cover_path, o.cover_style, null::text as cover_focal, null::text as cover_alt, null::smallint as cover_overlay,
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
  ), paged as (
    select * from combined
    order by case when _sort = 'newest' then extract(epoch from created_at) end desc nulls last,
             case when _sort = 'relevant' and _q is not null then (title ilike '%' || _q || '%')::int end desc nulls last,
             starts_at asc nulls last, created_at desc
    limit least(greatest(coalesce(_limit, 48), 1), 100) offset greatest(coalesce(_offset, 0), 0)
  )
  select coalesce(jsonb_agg(row_to_json(x)::jsonb - 'lat' - 'lng' - 'host_id'
    || jsonb_build_object('host_name', p.full_name, 'host_slug', p.slug,
                          'url', case when x.kind = 'event' then '/e/' || x.id else '/o/' || x.id end)), '[]'::jsonb)
  into result
  from paged x left join profiles p on p.id = x.host_id;
  return result;
end $function$;
GRANT EXECUTE ON FUNCTION public.discover_catalog(text, text[], text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, float8, float8, int, text, int, int) TO anon, authenticated;

-- 2) discover_coaches: published public host profiles only, bounded
CREATE FUNCTION public.discover_coaches(_q text DEFAULT NULL, _cat text DEFAULT NULL, _limit int DEFAULT 24, _offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'slug', x.slug, 'name', x.full_name, 'org', x.host_org,
      'avatar_path', x.avatar_url, 'cover_path', x.cover_url,
      'city', case when x.city_public then x.city else null end,
      'bio', nullif(left(coalesce(x.bio, ''), 240), ''),
      'categories', coalesce(x.host_categories, '{}'),
      'languages', coalesce(x.host_languages, '{}'),
      'followers', x.followers,
      'upcoming_count', x.upcoming,
      'offerings_count', x.offerings
    )), '[]'::jsonb)
    from (
      select p.id, p.slug, p.full_name, p.host_org, p.avatar_url, p.cover_url,
             p.city_public, p.city, p.bio, p.host_categories, p.host_languages,
             (select count(*) from follows f where f.target_kind = 'host' and f.target_id = p.id) as followers,
             (select count(*) from events e where e.host_id = p.id and e.status = 'published' and e.visibility = 'public' and e.starts_at > now()) as upcoming,
             (select count(*) from offers o where o.host_id = p.id and o.status = 'published' and o.visibility = 'public') as offerings
      from profiles p
      where p.host_public and p.slug is not null
        and (_q is null or p.full_name ilike '%' || _q || '%' or coalesce(p.host_org, '') ilike '%' || _q || '%' or coalesce(p.bio, '') ilike '%' || _q || '%')
        and (_cat is null or _cat = any(p.host_categories))
      order by upcoming desc, followers desc, p.full_name asc
      limit least(greatest(coalesce(_limit, 24), 1), 100) offset greatest(coalesce(_offset, 0), 0)
    ) x
  );
end $function$;
GRANT EXECUTE ON FUNCTION public.discover_coaches(text, text, int, int) TO anon, authenticated;

-- 3) public_cover_paths: server-only validator mapping public item refs to their cover/avatar storage paths.
--    Not granted to anon/authenticated: only the service role (signing server function) may call it.
CREATE FUNCTION public.public_cover_paths(_refs jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare r jsonb; k text; rid uuid; p text; av text; out jsonb := '[]'::jsonb;
begin
  if _refs is null or jsonb_typeof(_refs) <> 'array' then return out; end if;
  for r in select value from jsonb_array_elements(_refs) limit 120 loop
    k := r.value ->> 'kind';
    begin rid := (r.value ->> 'id')::uuid; exception when others then continue; end;
    p := null; av := null;
    if k = 'event' then
      select e.cover_url into p from events e where e.id = rid and e.status = 'published' and e.visibility = 'public';
    elsif k = 'offer' then
      select o.cover_url into p from offers o where o.id = rid and o.status = 'published' and o.visibility = 'public';
    elsif k = 'host' then
      select pr.cover_url, pr.avatar_url into p, av from profiles pr where pr.id = rid and pr.host_public;
    end if;
    if p is not null and p <> '' then
      out := out || jsonb_build_object('key', k || ':' || rid, 'path', p);
    end if;
    if av is not null and av <> '' then
      out := out || jsonb_build_object('key', k || ':' || rid || ':avatar', 'path', av);
    end if;
  end loop;
  return out;
end $function$;
REVOKE EXECUTE ON FUNCTION public.public_cover_paths(jsonb) FROM public, anon, authenticated;