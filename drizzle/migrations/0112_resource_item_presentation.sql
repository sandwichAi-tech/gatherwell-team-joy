ALTER TABLE public.tracks
  ADD COLUMN subtitle_en text, ADD COLUMN subtitle_es text,
  ADD COLUMN cta_en text, ADD COLUMN cta_es text,
  ADD COLUMN card_layout text NOT NULL DEFAULT 'preview',
  ADD COLUMN accent text NOT NULL DEFAULT 'plum',
  ADD COLUMN promo_en text, ADD COLUMN promo_es text;
ALTER TABLE public.tracks ADD CONSTRAINT tracks_card_layout_check CHECK (card_layout IN ('button','callout','preview'));
ALTER TABLE public.tracks ADD CONSTRAINT tracks_accent_check CHECK (accent IN ('plum','terracotta','concrete','ivory'));

ALTER TABLE public.offers
  ADD COLUMN subtitle_en text, ADD COLUMN subtitle_es text,
  ADD COLUMN cta_en text, ADD COLUMN cta_es text,
  ADD COLUMN card_layout text NOT NULL DEFAULT 'preview',
  ADD COLUMN accent text NOT NULL DEFAULT 'plum',
  ADD COLUMN promo_en text, ADD COLUMN promo_es text;
ALTER TABLE public.offers ADD CONSTRAINT offers_card_layout_check CHECK (card_layout IN ('button','callout','preview'));
ALTER TABLE public.offers ADD CONSTRAINT offers_accent_check CHECK (accent IN ('plum','terracotta','concrete','ivory'));

ALTER TABLE public.recipes
  ADD COLUMN subtitle_en text, ADD COLUMN subtitle_es text,
  ADD COLUMN cta_en text, ADD COLUMN cta_es text,
  ADD COLUMN card_layout text NOT NULL DEFAULT 'preview',
  ADD COLUMN accent text NOT NULL DEFAULT 'plum',
  ADD COLUMN promo_en text, ADD COLUMN promo_es text;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_card_layout_check CHECK (card_layout IN ('button','callout','preview'));
ALTER TABLE public.recipes ADD CONSTRAINT recipes_accent_check CHECK (accent IN ('plum','terracotta','concrete','ivory'));