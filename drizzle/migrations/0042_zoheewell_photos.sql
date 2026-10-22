update public.site_media s set image_path = null, default_url = v.u, default_alt_en = v.a, alt_en = v.a, default_alt_es = v.a, alt_es = v.a, default_credit = null, credit = null
from (values
('hero_card_1','/__l5e/assets-v1/616770a9-b43f-4e38-9e86-70a102d98a5d/zoheewell-hero_card_1.webp','Friends sharing a picnic outdoors'),
('hero_card_2','/__l5e/assets-v1/406c920f-588d-4d59-bc87-2caccaac8e84/zoheewell-hero_card_2.webp','Friends cycling together along a coastal trail'),
('hero_card_3','/__l5e/assets-v1/0fc4bffb-4c7f-40bb-81b1-d8bf428533b6/zoheewell-hero_card_3.webp','Friends talking over coffee outdoors'),
('hero_card_4','/__l5e/assets-v1/27de9b7a-9ba0-4252-96ed-0d4869417d04/zoheewell-hero_card_4.webp','Friends gardening together in a community garden'),
('host_band','/__l5e/assets-v1/e7ae8703-b0b0-463b-9376-ebb293419972/zoheewell-host_band.webp','A host leading a group dance class'),
('leaders_band','/__l5e/assets-v1/bc2c2717-ca6f-4776-be02-e2e0af9655cb/zoheewell-leaders_band.webp','A small group sharing ideas around notebooks'),
('og_share_image','https://joingatherwell.com/__l5e/assets-v1/213d9942-a2bb-496b-a324-66ff67476f6b/zoheewell-og_share_image.webp','People greeting one another at a wellness studio'),
('feed_default_fitcamp','/__l5e/assets-v1/3e6ca9b5-74cb-4003-ad95-34695395e7cb/zoheewell-feed_default_fitcamp.webp','Friends chatting after a studio workout'),
('feed_default_hike','/__l5e/assets-v1/2d210148-f35c-4f5e-8f21-0f5107e6ff32/zoheewell-feed_default_hike.webp','Two friends hiking above the coast'),
('feed_default_pickleball','/__l5e/assets-v1/7d7330ce-84a6-4170-a210-25c942c71986/zoheewell-feed_default_pickleball.webp','Friends playing pickleball outdoors'),
('feed_default_run','/__l5e/assets-v1/bfe7b84f-fe1d-4740-ad07-257093340212/zoheewell-feed_default_run.webp','A group jogging together in the park'),
('feed_default_soundbath','/__l5e/assets-v1/04a3d450-071c-4316-a5e6-4aca99ae53e0/zoheewell-feed_default_soundbath.webp','People making pottery together'),
('feed_default_walk','/__l5e/assets-v1/dd4e1318-56a3-4230-ab68-b3f59f262d94/zoheewell-feed_default_walk.webp','Friends walking a scenic coastal path'),
('feed_default_yoga','/__l5e/assets-v1/c0b84381-522d-47ba-8cfc-7613c5e342bb/zoheewell-feed_default_yoga.webp','A group stretching together outdoors')
) as v(s,u,a) where s.slot = v.s;