-- Dynamic challenge models, lifecycle status, activities and scheduled messages.
-- All additions are nullable or defaulted so existing challenges keep working (legacy rows map to model 'streak', status 'published').

ALTER TABLE public.challenges
  ADD COLUMN model text NOT NULL DEFAULT 'streak',
  ADD COLUMN goal_target integer,
  ADD COLUMN goal_unit text,
  ADD COLUMN frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN enrollment text NOT NULL DEFAULT 'open',
  ADD COLUMN capacity integer,
  ADD COLUMN timezone text,
  ADD COLUMN status text NOT NULL DEFAULT 'published',
  ADD COLUMN leaderboard_on boolean NOT NULL DEFAULT true;

ALTER TABLE public.challenges ADD CONSTRAINT challenges_model_values CHECK (model IN ('streak', 'goal', 'points'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_frequency_values CHECK (frequency IN ('daily', 'weekly'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_enrollment_values CHECK (enrollment IN ('open', 'invite'));
ALTER TABLE public.challenges ADD CONSTRAINT challenges_status_values CHECK (status IN ('draft', 'published'));

-- Draft challenges are visible to team leaders only; published ones keep the existing team read path.
DROP POLICY "Team and sub-team read challenges" ON public.challenges;
CREATE POLICY "Team and sub-team read challenges" ON public.challenges FOR SELECT TO authenticated
  USING ((status = 'published' AND can_use_team_templates(team_id)) OR is_team_member(team_id, ARRAY['leader']));

-- Daily/weekly activities and attached content per challenge.
CREATE TABLE public.challenge_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  title_en text NOT NULL DEFAULT '',
  title_es text NOT NULL DEFAULT '',
  instructions_en text,
  instructions_es text,
  day_offset integer,
  sort_order integer NOT NULL DEFAULT 0,
  requires_checkin boolean NOT NULL DEFAULT false,
  requires_note boolean NOT NULL DEFAULT false,
  due_hour integer,
  link_url text,
  resource_kind text,
  resource_id uuid,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_activities TO authenticated;
GRANT ALL ON public.challenge_activities TO service_role;
ALTER TABLE public.challenge_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read challenge activities" ON public.challenge_activities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND ((c.status = 'published' AND can_use_team_templates(c.team_id)) OR is_team_member(c.team_id, ARRAY['leader']))));
CREATE POLICY "Leaders manage challenge activities" ON public.challenge_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND is_team_member(c.team_id, ARRAY['leader'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND is_team_member(c.team_id, ARRAY['leader'])));

-- Scheduled challenge communications (welcome, reminders, prompts, announcements, completion).
CREATE TABLE public.challenge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  kind text NOT NULL,
  send_offset_days integer NOT NULL DEFAULT 0,
  send_hour integer NOT NULL DEFAULT 9,
  title_en text NOT NULL DEFAULT '',
  title_es text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_es text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'in_app',
  enabled boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_messages TO authenticated;
GRANT ALL ON public.challenge_messages TO service_role;
ALTER TABLE public.challenge_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read challenge messages" ON public.challenge_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND ((c.status = 'published' AND can_use_team_templates(c.team_id)) OR is_team_member(c.team_id, ARRAY['leader']))));
CREATE POLICY "Leaders manage challenge messages" ON public.challenge_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND is_team_member(c.team_id, ARRAY['leader'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND is_team_member(c.team_id, ARRAY['leader'])));