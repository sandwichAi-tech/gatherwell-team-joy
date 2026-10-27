ALTER FUNCTION public.duplicate_quiz(uuid) RENAME TO duplicate_quiz_base;
REVOKE ALL ON FUNCTION public.duplicate_quiz_base(uuid) FROM public, anon, authenticated;

-- One new canonical copy owned by the caller: copies Team/Coach choices and price, and only
-- course placements on courses the caller still owns; other courses are omitted.
CREATE OR REPLACE FUNCTION public.duplicate_quiz(_quiz uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nid uuid; z quizzes; d jsonb; courses jsonb; price int:=0;
BEGIN
 SELECT * INTO z FROM quizzes WHERE id=_quiz;
 nid:=duplicate_quiz_base(_quiz);
 UPDATE quizzes SET host_id=auth.uid(), archived_at=NULL,
  offer_id=CASE WHEN z.offer_id IS NOT NULL AND EXISTS(SELECT 1 FROM offers WHERE id=z.offer_id AND host_id=auth.uid() AND status<>'archived') THEN z.offer_id END,
  lesson_id=CASE WHEN z.offer_id IS NOT NULL AND EXISTS(SELECT 1 FROM offers WHERE id=z.offer_id AND host_id=auth.uid() AND status<>'archived') THEN z.lesson_id END,
  assessment_config=z.assessment_config, assessment_scope_id=z.assessment_scope_id
 WHERE id=nid;
 SELECT * INTO z FROM quizzes WHERE id=_quiz;
 IF z.offer_id IS NULL AND (SELECT offer_id FROM quizzes WHERE id=nid) IS NULL AND (SELECT host_id FROM quizzes WHERE id=nid)=auth.uid() THEN
  d:=resource_destinations('quiz',_quiz);
  SELECT coalesce(jsonb_agg(jsonb_build_object('course',x->>'course_id','section',x->>'section_id')),'[]') INTO courses
   FROM jsonb_array_elements(coalesce(d->'courses','[]')) x WHERE (x->>'available')::boolean AND NOT (x->>'contained')::boolean;
  IF z.commerce_offer_id IS NOT NULL THEN SELECT coalesce(price_cents,0) INTO price FROM offers WHERE id=z.commerce_offer_id AND host_id=auth.uid(); END IF;
  IF coalesce((d->>'team')::boolean,false) OR coalesce((d->>'coach')::boolean,false) OR jsonb_array_length(courses)>0 THEN
   PERFORM set_resource_destinations('quiz',nid,coalesce((d->>'team')::boolean,false),coalesce((d->>'coach')::boolean,false),courses,coalesce(price,0));
  END IF;
 END IF;
 RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.duplicate_quiz(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_quiz(uuid) TO authenticated;
