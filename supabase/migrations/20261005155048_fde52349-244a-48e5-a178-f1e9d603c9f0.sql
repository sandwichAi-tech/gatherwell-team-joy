INSERT INTO public.site_media (slot, sort_order, aspect, default_url, default_credit, default_alt_en, default_alt_es) VALUES
('hero_card_1',1,0.8,'https://images.unsplash.com/photo-1755705152604-af6804fb8932','Ufoma Ojo / Unsplash','Friends laughing together outdoors','Amigos riendo juntos al aire libre'),
('hero_card_2',2,0.8,'https://images.unsplash.com/photo-1769284331730-9955c15e7dac','Yuval Zukerman / Unsplash','A group running together on a sunlit boardwalk','Un grupo corriendo junto en un malecón soleado'),
('hero_card_3',3,0.8,'https://images.unsplash.com/photo-1772724317387-7e763804b637','Apartment Life / Unsplash','Friends sharing a laugh in the afternoon sun','Amigos compartiendo una risa bajo el sol de la tarde'),
('hero_card_4',4,0.8,'https://images.unsplash.com/photo-1758613171826-94fe6df8fd44','Vitaly Gariev / Unsplash','Friends walking through a park at golden hour','Amigos caminando por un parque al atardecer'),
('feed_default_run',10,1.6,'https://images.unsplash.com/photo-1769284331730-9955c15e7dac','Yuval Zukerman / Unsplash','A run club on the move','Un club de corredores en movimiento'),
('feed_default_fitcamp',11,1.6,'https://images.unsplash.com/photo-1775850576183-a7671ba5dc46','Nadin Nandin / Unsplash','An outdoor group workout in the park','Un entrenamiento grupal al aire libre en el parque'),
('feed_default_yoga',12,1.6,'https://images.unsplash.com/photo-1758274534019-5164e277b2d8','Vitaly Gariev / Unsplash','Yoga together outdoors in a park','Yoga en grupo al aire libre en un parque'),
('feed_default_soundbath',13,1.6,'https://images.unsplash.com/photo-1760691313751-98262affa4f9','Kabita Captured / Unsplash','A sound bath with gong and singing bowls','Un baño de sonido con gong y cuencos'),
('feed_default_hike',14,1.6,'https://images.unsplash.com/photo-1758599668842-798d870b3210','Vitaly Gariev / Unsplash','Friends celebrating on a forest trail','Amigos celebrando en un sendero del bosque'),
('feed_default_walk',15,1.6,'https://images.unsplash.com/photo-1761055923379-b32b0efd1699','Samuell Morgenstern / Unsplash','Friends laughing on a walk through the park','Amigas riendo durante una caminata por el parque'),
('feed_default_pickleball',16,1.6,'https://images.unsplash.com/photo-1761644789725-98e84ef4b8c8','Hoi Pham / Unsplash','Players mid-rally in a pickleball match','Jugadores en pleno punto de pickleball'),
('host_band',20,2.4,'https://images.unsplash.com/photo-1772206605293-3fadeaa944e1','Gary Parris / Unsplash','A host leading an outdoor group class','Un anfitrión guiando una clase grupal al aire libre'),
('leaders_band',21,2.4,'https://images.unsplash.com/photo-1753381685958-51ea26e173f6','Gleb Khodiakov / Unsplash','A small group talking together at sunset','Un grupo pequeño conversando al atardecer'),
('og_share_image',30,1.905,'https://images.unsplash.com/photo-1525776658211-37bdb8a0b32b','Noah Benjamin / Unsplash','A community gathered on an open field at golden hour','Una comunidad reunida en un campo abierto al atardecer')
ON CONFLICT (slot) DO NOTHING;
UPDATE public.site_media SET credit = default_credit, alt_en = default_alt_en, alt_es = default_alt_es WHERE image_path IS NULL AND credit IS NULL;