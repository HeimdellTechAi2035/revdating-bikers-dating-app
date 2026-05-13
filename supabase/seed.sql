-- =============================================================
-- RevMatch — Seed Data (Development Only)
-- DO NOT run against a production database.
-- Applied automatically by: supabase db reset
-- =============================================================

-- =============================================================
-- Promote the first local dev user to super_admin
-- (Sign up once via the app, then re-run or re-reset)
-- =============================================================
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users LIMIT 1;
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO admin_users (id, role)
    VALUES (v_admin_id, 'super_admin')
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
    RAISE NOTICE 'Promoted % to super_admin', v_admin_id;
  ELSE
    RAISE NOTICE 'No users found — sign up first, then re-run seed';
  END IF;
END;
$$;

-- =============================================================
-- Synthetic dev profiles — 10 UK bikers
-- UUIDs are stable so reruns are idempotent.
-- =============================================================
DO $$
DECLARE
  -- Stable UUIDs for seed users
  uid_jake    UUID := 'aaaaaaaa-0001-4000-8000-000000000001';
  uid_sarah   UUID := 'aaaaaaaa-0002-4000-8000-000000000002';
  uid_callum  UUID := 'aaaaaaaa-0003-4000-8000-000000000003';
  uid_priya   UUID := 'aaaaaaaa-0004-4000-8000-000000000004';
  uid_dom     UUID := 'aaaaaaaa-0005-4000-8000-000000000005';
  uid_mel     UUID := 'aaaaaaaa-0006-4000-8000-000000000006';
  uid_finn    UUID := 'aaaaaaaa-0007-4000-8000-000000000007';
  uid_nina    UUID := 'aaaaaaaa-0008-4000-8000-000000000008';
  uid_rory    UUID := 'aaaaaaaa-0009-4000-8000-000000000009';
  uid_tash    UUID := 'aaaaaaaa-0010-4000-8000-000000000010';
BEGIN
  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM profiles WHERE id = uid_jake) THEN
    RAISE NOTICE 'Seed profiles already exist — skipping';
    RETURN;
  END IF;

  -- -------------------------------------------------------
  -- Create auth.users entries for each synthetic user
  -- -------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  VALUES
    (uid_jake,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'jake@seed.dev',   crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_sarah,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'sarah@seed.dev',  crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_callum, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'callum@seed.dev', crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_priya,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'priya@seed.dev',  crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_dom,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'dom@seed.dev',    crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_mel,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'mel@seed.dev',    crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_finn,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'finn@seed.dev',   crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_nina,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'nina@seed.dev',   crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_rory,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'rory@seed.dev',   crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}'),
    (uid_tash,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'tash@seed.dev',   crypt('SeedPass1!', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"provider":"email","providers":["email"]}', '{}')
  ON CONFLICT (id) DO NOTHING;

  -- -------------------------------------------------------
  -- Profiles
  -- The handle_new_user trigger may have run; use ON CONFLICT
  -- to overwrite with full seed data.
  -- -------------------------------------------------------

  -- Jake Malone — Manchester, Harley cruiser guy
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_jake, 'Jake M', '1990-03-15', 'man', 'women', 'serious_relationship',
    'Cruiser rider from Manchester. Harley Davidson owner for 8 years. Love rallies and long weekend rides through the Peaks.',
    53.4808, -2.2426, 'Manchester', 'GB', 75,
    'cruiser', 8, 'member', TRUE,
    ARRAY['rock','classic_rock'], FALSE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, NOW() - INTERVAL '2 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Sarah Vance — London, BMW GS adventure rider
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_sarah, 'Sarah V', '1993-07-22', 'woman', 'men', 'riding_partner',
    'BMW GS rider based in London. Weekend escapes to Scotland or the Alps. Looking for someone to share the miles with.',
    51.5074, -0.1278, 'London', 'GB', 100,
    'adventure', 5, 'independent', TRUE,
    ARRAY['indie','alternative'], FALSE, TRUE, FALSE,
    TRUE, FALSE, TRUE, TRUE, NOW() - INTERVAL '1 hour'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Callum Reid — Edinburgh, Triumph cafe racer
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_callum, 'Callum R', '1988-11-04', 'man', 'everyone', 'casual_dating',
    'Triumph Thruxton on the NC500. Edinburgh based, ride year round. Coffee shops and canyon roads.',
    55.9533, -3.1883, 'Edinburgh', 'GB', 80,
    'cafe_racer', 12, 'none', FALSE,
    ARRAY['rock','jazz','blues'], TRUE, TRUE, FALSE,
    FALSE, FALSE, TRUE, TRUE, NOW() - INTERVAL '6 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Priya Sharma — Birmingham, Kawasaki Z900
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_priya, 'Priya S', '1995-02-18', 'woman', 'men', 'serious_relationship',
    'Kawasaki Z900 naked rider. Birmingham girl, ride every weekend. Huge fan of Goodwood and the TT.',
    52.4862, -1.8904, 'Birmingham', 'GB', 60,
    'naked', 4, 'none', TRUE,
    ARRAY['pop','hip_hop','r&b'], FALSE, FALSE, TRUE,
    TRUE, TRUE, TRUE, TRUE, NOW() - INTERVAL '30 minutes'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Dom Westley — Bristol, KTM enduro
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_dom, 'Dom W', '1992-09-30', 'man', 'women', 'open_to_anything',
    'KTM 890 Adventure. Bristol based, take it off-road most weekends. Looking for someone who doesn''t mind mud.',
    51.4545, -2.5879, 'Bristol', 'GB', 50,
    'dirt', 10, 'independent', FALSE,
    ARRAY['metal','punk'], FALSE, TRUE, FALSE,
    FALSE, FALSE, TRUE, TRUE, NOW() - INTERVAL '1 day'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Mel Torres — Leeds, Ducati Panigale
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_mel, 'Mel T', '1991-06-12', 'woman', 'everyone', 'friendship',
    'Ducati Panigale V4 owner. Trackday addict based in Leeds. Rossi fan. Probably going too fast.',
    53.8008, -1.5491, 'Leeds', 'GB', 90,
    'sport', 7, 'member', TRUE,
    ARRAY['electronic','techno'], FALSE, TRUE, FALSE,
    TRUE, TRUE, TRUE, TRUE, NOW() - INTERVAL '3 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Finn O''Brien — Liverpool, Royal Enfield Interceptor
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_finn, 'Finn O', '1994-04-07', 'man', 'women', 'serious_relationship',
    'Royal Enfield Interceptor 650. Liverpool lad, ride the coast roads most Sundays. Proper trad biker.',
    53.4084, -2.9916, 'Liverpool', 'GB', 60,
    'cruiser', 6, 'member', TRUE,
    ARRAY['classic_rock','blues'], TRUE, TRUE, TRUE,
    FALSE, FALSE, TRUE, TRUE, NOW() - INTERVAL '5 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Nina Walsh — Sheffield, Honda CB500F
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_nina, 'Nina W', '1997-08-25', 'woman', 'men', 'casual_dating',
    'A2 licence holder on a Honda CB500F. Sheffield. Been riding 2 years and completely hooked. Peak District is my backyard.',
    53.3811, -1.4701, 'Sheffield', 'GB', 40,
    'naked', 2, 'none', FALSE,
    ARRAY['indie','pop'], FALSE, FALSE, FALSE,
    FALSE, FALSE, TRUE, TRUE, NOW() - INTERVAL '2 days'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Rory Campbell — Glasgow, BMW R 1250 GS
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_rory, 'Rory C', '1986-12-01', 'man', 'women', 'riding_partner',
    'BMW R 1250 GS Adventure. Glasgow, ride the Highlands all year. Done Europe twice. Looking for a co-pilot.',
    55.8642, -4.2518, 'Glasgow', 'GB', 120,
    'touring', 18, 'member', TRUE,
    ARRAY['country','folk'], FALSE, TRUE, TRUE,
    TRUE, TRUE, TRUE, TRUE, NOW() - INTERVAL '4 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- Tash Quinn — Cardiff, Yamaha MT-07
  INSERT INTO profiles (
    id, display_name, date_of_birth, gender, interested_in, dating_intent, bio,
    latitude, longitude, city, country, max_distance_miles,
    riding_style, years_riding, club_status, attends_rallies,
    music_taste, smoker, drinker, has_passenger_helmet,
    is_verified, is_premium, onboarding_complete, is_active,
    last_active
  ) VALUES (
    uid_tash, 'Tash Q', '1993-01-14', 'woman', 'men', 'serious_relationship',
    'Yamaha MT-07. Cardiff based. Love the Brecon Beacons and Snowdonia runs. Hate the M4.',
    51.4816, -3.1791, 'Cardiff', 'GB', 70,
    'naked', 5, 'independent', FALSE,
    ARRAY['rock','alternative'], FALSE, TRUE, TRUE,
    TRUE, FALSE, TRUE, TRUE, NOW() - INTERVAL '12 hours'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
    onboarding_complete = TRUE, is_active = TRUE;

  -- -------------------------------------------------------
  -- Bikes
  -- -------------------------------------------------------
  INSERT INTO bikes (user_id, bike_type, bike_brand, bike_model, bike_year, engine_size_cc, owned_or_dream, primary_bike)
  VALUES
    (uid_jake,   'cruiser',    'Harley-Davidson', 'Fat Boy 114',        2021, 1868, 'owned', TRUE),
    (uid_jake,   'cruiser',    'Harley-Davidson', 'Sportster Iron 883', 2018,  883, 'owned', FALSE),
    (uid_sarah,  'adventure',  'BMW',             'R 1250 GS',          2022, 1254, 'owned', TRUE),
    (uid_callum, 'cafe_racer', 'Triumph',         'Thruxton RS',        2020,  1200, 'owned', TRUE),
    (uid_priya,  'naked',      'Kawasaki',        'Z900',               2023,  948, 'owned', TRUE),
    (uid_priya,  'naked',      'Ducati',          'Monster 1200',       2025, 1198, 'dream', FALSE),
    (uid_dom,    'dirt',       'KTM',             '890 Adventure R',    2023,  890, 'owned', TRUE),
    (uid_mel,    'sport',      'Ducati',          'Panigale V4',        2022, 1103, 'owned', TRUE),
    (uid_finn,   'cruiser',    'Royal Enfield',   'Interceptor 650',    2021,  648, 'owned', TRUE),
    (uid_nina,   'naked',      'Honda',           'CB500F',             2023,  471, 'owned', TRUE),
    (uid_nina,   'naked',      'Honda',           'CB1000R',            2025, 1000, 'dream', FALSE),
    (uid_rory,   'touring',    'BMW',             'R 1250 GS Adventure',2022, 1254, 'owned', TRUE),
    (uid_tash,   'naked',      'Yamaha',          'MT-07',              2022,  689, 'owned', TRUE),
    (uid_tash,   'naked',      'Yamaha',          'MT-09',              2025,  890, 'dream', FALSE)
  ON CONFLICT DO NOTHING;

  -- -------------------------------------------------------
  -- Superlike credits + daily swipe counts
  -- (handle_new_user trigger should have inserted these,
  --  but ensure they exist for seed users)
  -- -------------------------------------------------------
  INSERT INTO superlike_credits (user_id, credits)
  VALUES
    (uid_jake, 5), (uid_sarah, 3), (uid_callum, 3),
    (uid_priya, 5), (uid_dom, 3), (uid_mel, 5),
    (uid_finn, 3), (uid_nina, 3), (uid_rory, 5), (uid_tash, 3)
  ON CONFLICT (user_id) DO UPDATE SET credits = EXCLUDED.credits;

  INSERT INTO daily_swipe_counts (user_id, count, reset_date)
  VALUES
    (uid_jake, 0, CURRENT_DATE), (uid_sarah, 0, CURRENT_DATE),
    (uid_callum, 0, CURRENT_DATE), (uid_priya, 0, CURRENT_DATE),
    (uid_dom, 0, CURRENT_DATE), (uid_mel, 0, CURRENT_DATE),
    (uid_finn, 0, CURRENT_DATE), (uid_nina, 0, CURRENT_DATE),
    (uid_rory, 0, CURRENT_DATE), (uid_tash, 0, CURRENT_DATE)
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Seeded 10 dev profiles with bikes';
END;
$$;

-- =============================================================
-- Profile photos — placeholder images so seed users appear in discovery
-- get_discovery_candidates requires an approved primary photo.
-- Uses picsum.photos seeded URLs for deterministic, realistic images.
-- =============================================================
DO $$
DECLARE
  uid_jake    UUID := 'aaaaaaaa-0001-4000-8000-000000000001';
  uid_sarah   UUID := 'aaaaaaaa-0002-4000-8000-000000000002';
  uid_callum  UUID := 'aaaaaaaa-0003-4000-8000-000000000003';
  uid_priya   UUID := 'aaaaaaaa-0004-4000-8000-000000000004';
  uid_dom     UUID := 'aaaaaaaa-0005-4000-8000-000000000005';
  uid_mel     UUID := 'aaaaaaaa-0006-4000-8000-000000000006';
  uid_finn    UUID := 'aaaaaaaa-0007-4000-8000-000000000007';
  uid_nina    UUID := 'aaaaaaaa-0008-4000-8000-000000000008';
  uid_rory    UUID := 'aaaaaaaa-0009-4000-8000-000000000009';
  uid_tash    UUID := 'aaaaaaaa-0010-4000-8000-000000000010';
BEGIN
  IF EXISTS (SELECT 1 FROM profile_photos WHERE user_id = uid_jake) THEN
    RAISE NOTICE 'Seed photos already exist — skipping';
    RETURN;
  END IF;

  INSERT INTO profile_photos (user_id, storage_path, public_url, is_primary, moderation_status, sort_order)
  VALUES
    -- Jake — primary + secondary
    (uid_jake,   'seed/jake-1.jpg',   'https://picsum.photos/seed/jake1/800/1000',   TRUE,  'approved', 0),
    (uid_jake,   'seed/jake-2.jpg',   'https://picsum.photos/seed/jake2/800/1000',   FALSE, 'approved', 1),
    -- Sarah
    (uid_sarah,  'seed/sarah-1.jpg',  'https://picsum.photos/seed/sarah1/800/1000',  TRUE,  'approved', 0),
    (uid_sarah,  'seed/sarah-2.jpg',  'https://picsum.photos/seed/sarah2/800/1000',  FALSE, 'approved', 1),
    -- Callum
    (uid_callum, 'seed/callum-1.jpg', 'https://picsum.photos/seed/callum1/800/1000', TRUE,  'approved', 0),
    -- Priya
    (uid_priya,  'seed/priya-1.jpg',  'https://picsum.photos/seed/priya1/800/1000',  TRUE,  'approved', 0),
    (uid_priya,  'seed/priya-2.jpg',  'https://picsum.photos/seed/priya2/800/1000',  FALSE, 'approved', 1),
    -- Dom
    (uid_dom,    'seed/dom-1.jpg',    'https://picsum.photos/seed/dom1/800/1000',    TRUE,  'approved', 0),
    -- Mel
    (uid_mel,    'seed/mel-1.jpg',    'https://picsum.photos/seed/mel1/800/1000',    TRUE,  'approved', 0),
    (uid_mel,    'seed/mel-2.jpg',    'https://picsum.photos/seed/mel2/800/1000',    FALSE, 'approved', 1),
    -- Finn
    (uid_finn,   'seed/finn-1.jpg',   'https://picsum.photos/seed/finn1/800/1000',   TRUE,  'approved', 0),
    -- Nina
    (uid_nina,   'seed/nina-1.jpg',   'https://picsum.photos/seed/nina1/800/1000',   TRUE,  'approved', 0),
    -- Rory
    (uid_rory,   'seed/rory-1.jpg',   'https://picsum.photos/seed/rory1/800/1000',   TRUE,  'approved', 0),
    (uid_rory,   'seed/rory-2.jpg',   'https://picsum.photos/seed/rory2/800/1000',   FALSE, 'approved', 1),
    -- Tash
    (uid_tash,   'seed/tash-1.jpg',   'https://picsum.photos/seed/tash1/800/1000',   TRUE,  'approved', 0)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded profile photos';
END;
$$;

-- =============================================================
-- Matches and messages between seed users
-- Pairs based on gender + interested_in compatibility.
-- =============================================================
DO $$
DECLARE
  uid_jake    UUID := 'aaaaaaaa-0001-4000-8000-000000000001';
  uid_sarah   UUID := 'aaaaaaaa-0002-4000-8000-000000000002';
  uid_callum  UUID := 'aaaaaaaa-0003-4000-8000-000000000003';
  uid_priya   UUID := 'aaaaaaaa-0004-4000-8000-000000000004';
  uid_dom     UUID := 'aaaaaaaa-0005-4000-8000-000000000005';
  uid_mel     UUID := 'aaaaaaaa-0006-4000-8000-000000000006';
  uid_finn    UUID := 'aaaaaaaa-0007-4000-8000-000000000007';
  uid_nina    UUID := 'aaaaaaaa-0008-4000-8000-000000000008';
  uid_rory    UUID := 'aaaaaaaa-0009-4000-8000-000000000009';
  uid_tash    UUID := 'aaaaaaaa-0010-4000-8000-000000000010';

  mid_jake_sarah   UUID := 'bbbbbbbb-0001-4000-8000-000000000001';
  mid_jake_priya   UUID := 'bbbbbbbb-0002-4000-8000-000000000002';
  mid_callum_mel   UUID := 'bbbbbbbb-0003-4000-8000-000000000003';
  mid_rory_tash    UUID := 'bbbbbbbb-0004-4000-8000-000000000004';
  mid_dom_nina     UUID := 'bbbbbbbb-0005-4000-8000-000000000005';
  mid_finn_mel     UUID := 'bbbbbbbb-0006-4000-8000-000000000006';
BEGIN
  IF EXISTS (SELECT 1 FROM matches WHERE id = mid_jake_sarah) THEN
    RAISE NOTICE 'Seed matches already exist — skipping';
    RETURN;
  END IF;

  -- ── Swipes (mutual likes) ──────────────────────────────────────────────

  -- Jake ↔ Sarah
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_jake,  uid_sarah, 'like'),
    (uid_sarah, uid_jake,  'like')
  ON CONFLICT DO NOTHING;

  -- Jake ↔ Priya
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_jake,  uid_priya, 'superlike'),
    (uid_priya, uid_jake,  'like')
  ON CONFLICT DO NOTHING;

  -- Callum ↔ Mel (both 'everyone')
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_callum, uid_mel, 'like'),
    (uid_mel,    uid_callum, 'like')
  ON CONFLICT DO NOTHING;

  -- Rory ↔ Tash
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_rory, uid_tash, 'like'),
    (uid_tash, uid_rory, 'like')
  ON CONFLICT DO NOTHING;

  -- Dom ↔ Nina
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_dom,  uid_nina, 'like'),
    (uid_nina, uid_dom,  'like')
  ON CONFLICT DO NOTHING;

  -- Finn ↔ Mel (Mel is 'everyone', Finn likes women)
  INSERT INTO swipes (swiper_id, swiped_id, swipe_action) VALUES
    (uid_finn, uid_mel, 'like'),
    (uid_mel,  uid_finn, 'like')
  ON CONFLICT DO NOTHING;

  -- ── Matches ──────────────────────────────────────────────────────────────

  INSERT INTO matches (id, user1_id, user2_id, user1_superliked, user2_superliked, is_active, created_at, last_message_at)
  VALUES
    (mid_jake_sarah, uid_jake,   uid_sarah,  FALSE, FALSE, TRUE, NOW() - INTERVAL '5 days',  NOW() - INTERVAL '1 hour'),
    (mid_jake_priya, uid_jake,   uid_priya,  TRUE,  FALSE, TRUE, NOW() - INTERVAL '3 days',  NOW() - INTERVAL '30 minutes'),
    (mid_callum_mel, uid_callum, uid_mel,    FALSE, FALSE, TRUE, NOW() - INTERVAL '7 days',  NOW() - INTERVAL '2 hours'),
    (mid_rory_tash,  uid_rory,   uid_tash,   FALSE, FALSE, TRUE, NOW() - INTERVAL '2 days',  NOW() - INTERVAL '4 hours'),
    (mid_dom_nina,   uid_dom,    uid_nina,   FALSE, FALSE, TRUE, NOW() - INTERVAL '1 day',   NOW() - INTERVAL '6 hours'),
    (mid_finn_mel,   uid_finn,   uid_mel,    FALSE, FALSE, TRUE, NOW() - INTERVAL '4 days',  NOW() - INTERVAL '12 hours')
  ON CONFLICT (id) DO NOTHING;

  -- ── Messages ─────────────────────────────────────────────────────────────

  -- Jake & Sarah
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at)
  VALUES
    (mid_jake_sarah, uid_jake,  'Hey Sarah! Saw you''re a GS rider — done the NC500?',                           TRUE,  NOW() - INTERVAL '5 days'  + INTERVAL '1 hour'),
    (mid_jake_sarah, uid_sarah, 'Twice! Last time in October — stunning but absolutely freezing 😅',              TRUE,  NOW() - INTERVAL '5 days'  + INTERVAL '2 hours'),
    (mid_jake_sarah, uid_jake,  'Ha! I did it in July on the Fat Boy. Your GS is way more suited to it though.', TRUE,  NOW() - INTERVAL '4 days'),
    (mid_jake_sarah, uid_sarah, 'A Fat Boy on the NC500 — respect! What''s your next big ride?',                  TRUE,  NOW() - INTERVAL '3 days'),
    (mid_jake_sarah, uid_jake,  'Planning the Alps in August. You?',                                              TRUE,  NOW() - INTERVAL '2 days'),
    (mid_jake_sarah, uid_sarah, 'Alps sounds amazing. I''m eyeing up the Dolomites myself.',                      FALSE, NOW() - INTERVAL '1 hour')
  ON CONFLICT DO NOTHING;

  -- Jake & Priya
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at)
  VALUES
    (mid_jake_priya, uid_jake,  'Hi Priya! The Z900 is a brilliant bike — been riding long?',                    TRUE,  NOW() - INTERVAL '3 days'  + INTERVAL '1 hour'),
    (mid_jake_priya, uid_priya, 'About 4 years now. Started on a CB300 then jumped to the Z. Your Harley is 🔥', TRUE,  NOW() - INTERVAL '3 days'  + INTERVAL '3 hours'),
    (mid_jake_priya, uid_jake,  'Cheers! Nothing like a big twin cruiser. Are you going to the Goodwood Revival?', TRUE, NOW() - INTERVAL '2 days'),
    (mid_jake_priya, uid_priya, 'Yes! Every year. Maybe we could meet up there?',                                  FALSE, NOW() - INTERVAL '30 minutes')
  ON CONFLICT DO NOTHING;

  -- Callum & Mel
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at)
  VALUES
    (mid_callum_mel, uid_callum, 'Hey Mel! A Panigale V4 — do you track it?',                                    TRUE,  NOW() - INTERVAL '7 days' + INTERVAL '2 hours'),
    (mid_callum_mel, uid_mel,    'Every chance I get. Knockhill, Cadwell, Donington. You?',                       TRUE,  NOW() - INTERVAL '6 days'),
    (mid_callum_mel, uid_callum, 'More roads than tracks but I''ve done a few track days at Knockhill.',          TRUE,  NOW() - INTERVAL '5 days'),
    (mid_callum_mel, uid_mel,    'We should do a day together! I can show you the fast lines 😄',                 TRUE,  NOW() - INTERVAL '4 days'),
    (mid_callum_mel, uid_callum, 'Deal! Next Knockhill open pitlane day?',                                        TRUE,  NOW() - INTERVAL '3 days'),
    (mid_callum_mel, uid_mel,    'I''ll check the calendar and send you dates.',                                  FALSE, NOW() - INTERVAL '2 hours')
  ON CONFLICT DO NOTHING;

  -- Rory & Tash
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at)
  VALUES
    (mid_rory_tash, uid_rory, 'Hi Tash! Fellow adventure tourer here. Done Snowdonia on the GS lately?',        TRUE,  NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
    (mid_rory_tash, uid_tash, 'Last month! The Bwlch y Groes pass is incredible. You should come down.',        TRUE,  NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
    (mid_rory_tash, uid_rory, 'It''s on the list. The Highlands are calling me first but Wales is next.',        TRUE,  NOW() - INTERVAL '1 day'),
    (mid_rory_tash, uid_tash, 'Let me know when you''re coming south — I know all the good roads.',              FALSE, NOW() - INTERVAL '4 hours')
  ON CONFLICT DO NOTHING;

  -- Dom & Nina
  INSERT INTO messages (match_id, sender_id, content, is_read, created_at)
  VALUES
    (mid_dom_nina, uid_dom,  'Hey Nina! Sheffield to Bristol is doable for a Peak District ride if you''re up for it?', TRUE,  NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
    (mid_dom_nina, uid_nina, 'That''s a long way for you! But yes the Peaks are amazing. What''s your route?',          TRUE,  NOW() - INTERVAL '1 day' + INTERVAL '4 hours'),
    (mid_dom_nina, uid_dom,  'M5 is terrible on the KTM. I''d come via the A44 through the hills.',                     TRUE,  NOW() - INTERVAL '22 hours'),
    (mid_dom_nina, uid_nina, 'The A44 is gorgeous! Let''s plan something for next month.',                               FALSE, NOW() - INTERVAL '6 hours')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seeded matches and messages';
END;
$$;
