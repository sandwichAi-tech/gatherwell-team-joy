CREATE OR REPLACE FUNCTION public.public_cover_paths(_refs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb; k text; rid uuid; p text; av text; out jsonb := '[]'::jsonb;
begin
  if _refs is null or jsonb_typeof(_refs) <> 'array' then return out; end if;
  for r in select value from jsonb_array_elements(_refs) limit 120 loop
    k := r ->> 'kind';
    begin rid := (r ->> 'id')::uuid; exception when others then continue; end;
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
REVOKE ALL ON FUNCTION public.public_cover_paths(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_cover_paths(jsonb) TO service_role;