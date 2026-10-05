UPDATE public.site_media AS s SET
  default_url = v.url, default_credit = v.credit, default_alt_en = v.en, default_alt_es = v.es,
  credit = v.credit, alt_en = v.en, alt_es = v.es, focal_x = v.fx, focal_y = v.fy
FROM (VALUES
  ('hero_card_1','https://images.unsplash.com/photo-1758274533351-6f5f6e0bbdcb','Vitaly Gariev / Unsplash','Friends sharing tea on a picnic blanket in an autumn park','Amigas compartiendo té sobre una manta en un parque de otoño',0.55::real,0.5::real),
  ('hero_card_3','https://images.unsplash.com/photo-1752650143267-57c2491f5ba2','Vitaly Gariev / Unsplash','Friends laughing as they walk together on a sunny street','Amigos riendo mientras caminan juntos por una calle soleada',0.5::real,0.45::real),
  ('feed_default_run','https://images.unsplash.com/photo-1759167581561-3b1fbe906b52','Maxim Tolchinskiy / Unsplash','A group running along the waterfront at golden hour','Un grupo corriendo junto al agua al atardecer',0.45::real,0.6::real)
) AS v(slot,url,credit,en,es,fx,fy)
WHERE s.slot = v.slot AND s.image_path IS NULL;