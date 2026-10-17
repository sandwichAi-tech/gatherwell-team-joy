INSERT INTO public.feature_flags (key, enabled, description_en, description_es) VALUES
('feature_learn', false, 'Learn tracks, lessons and recipes. Lessons inside Circles stay on.', 'Rutas, lecciones y recetas de Aprender. Las lecciones dentro de los Círculos siguen activas.'),
('feature_network', false, 'Network and partner sharing.', 'Red y compartir con socios.'),
('feature_retreats', false, 'Retreats and trips, 1:1 sessions, cohort courses, quizzes and certificates.', 'Retiros y viajes, sesiones 1:1, cursos por grupo, cuestionarios y certificados.'),
('feature_badges_limited', false, 'Limited-edition badges and personal bests.', 'Insignias de edición limitada y mejores marcas personales.'),
('feature_playbook', false, 'Playbook cards (until there is enough real data).', 'Tarjetas de estrategias (hasta que haya datos reales suficientes).'),
('feature_team_map', false, 'Team map.', 'Mapa del equipo.')
ON CONFLICT (key) DO NOTHING;