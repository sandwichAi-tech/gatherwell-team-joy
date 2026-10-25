CREATE OR REPLACE FUNCTION public.is_safe_return_path(_p text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _p IS NOT NULL
    AND length(_p) BETWEEN 1 AND 512
    AND _p !~ '[%\\\s]'
    AND _p ~ '^/[^/]'
    AND _p !~ ':|[.][.]|[#]'
    AND _p ~ '^/(e|l|t|h|i|r|join|offer|event|learn|learn/track|learn/lesson|challenge)/[A-Za-z0-9_-]{1,80}([?][A-Za-z0-9=&_-]{0,200})?$|^/(home|discover|gathering/new|events|learn|me|start|communications)$|^/support([?][A-Za-z0-9=&_-]{0,200})?$'
$function$;