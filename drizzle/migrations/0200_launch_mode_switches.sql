CREATE TABLE IF NOT EXISTS public.host_feature_interest (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.host_feature_interest TO authenticated;
GRANT ALL ON public.host_feature_interest TO service_role;
ALTER TABLE public.host_feature_interest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts read own interest" ON public.host_feature_interest FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Hosts record own interest" ON public.host_feature_interest FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
COMMENT ON TABLE public.host_feature_interest IS 'One row per host who tapped Notify me on the Tools Coming soon card (launch mode 2026-10-29).';

INSERT INTO public.feature_flags (key, enabled, description_en, description_es) VALUES
 ('feature_learn', true, 'Resources: tracks, lessons and recipes.', 'Recursos: rutas, lecciones y recetas.'),
 ('feature_network', false, 'Network and partner sharing.', 'Red y compartir con socios.'),
 ('feature_retreats', false, 'Retreats and trips, 1:1 sessions, cohort courses, quizzes and certificates.', 'Retiros y viajes, sesiones 1:1, cursos por grupo, cuestionarios y certificados.'),
 ('feature_badges_limited', false, 'Limited-edition badges and personal bests.', 'Insignias de edición limitada y mejores marcas personales.'),
 ('feature_playbook', false, 'Playbook cards (until there is enough real data).', 'Tarjetas de estrategias (hasta que haya datos reales suficientes).'),
 ('feature_team_map', false, 'Team map.', 'Mapa del equipo.'),
 ('feature_selling', false, 'Paid selling: offers, Circles, promo codes, earnings, seats, paid tickets, paid resources and paid challenges, and the money steps in the host checklist.', 'Ventas pagadas: ofertas, Círculos, códigos promocionales, ganancias, lugares, boletos pagados, recursos y retos pagados, y los pasos de dinero de la lista del anfitrión.'),
 ('feature_referrals', false, 'Referral programs and "My referral earnings".', 'Programas de referidos y "Mis ganancias por referidos".'),
 ('feature_automations', false, 'Automatic messages and journeys in Communications. Message templates and follow-ups stay on.', 'Mensajes automáticos y recorridos en Comunicaciones. Las plantillas y los seguimientos siguen activos.'),
 ('feature_courses', false, 'Courses, bundles and live sessions as resource types, and certificates.', 'Cursos, paquetes y sesiones en vivo como tipos de recurso, y certificados.'),
 ('feature_assessment', false, 'Wellness assessment resource type.', 'Tipo de recurso Evaluación de bienestar.'),
 ('feature_alerts', false, 'Event alerts ("Notify me" on Discover).', 'Alertas de eventos ("Avísame" en Descubrir).'),
 ('feature_locations', false, 'Saved locations for hosts.', 'Lugares guardados para anfitriones.'),
 ('feature_marketing_extra', false, 'Careers and Studios pages on the public site.', 'Páginas de Empleos y Estudios en el sitio público.')
ON CONFLICT (key) DO NOTHING;