/**
 * scripts/setup-supabase.mjs
 *
 * Runs all 22 database migrations against your Supabase project,
 * then creates and configures the two storage buckets.
 *
 * Usage (from project root):
 *   node --env-file=.env.local scripts/setup-supabase.mjs
 *
 * Requirements:
 *   - SUPABASE_DB_URL          in .env.local  (for migrations)
 *   - NEXT_PUBLIC_SUPABASE_URL in .env.local  (for storage setup)
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local (for storage setup)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Colours for terminal output ─────────────────────────────────────────────
const G = '\x1b[32m';   // green
const R = '\x1b[31m';   // red
const Y = '\x1b[33m';   // yellow
const B = '\x1b[36m';   // cyan
const X = '\x1b[0m';    // reset

function ok(msg)   { console.log(`${G}  ✓${X}  ${msg}`); }
function fail(msg) { console.log(`${R}  ✗${X}  ${msg}`); }
function info(msg) { console.log(`${B}  →${X}  ${msg}`); }
function warn(msg) { console.log(`${Y}  !${X}  ${msg}`); }
function header(msg) { console.log(`\n${B}══ ${msg} ══${X}`); }

// ─── 1. Validate environment ──────────────────────────────────────────────────

header('Checking environment variables');

const DB_URL      = process.env.SUPABASE_DB_URL;
const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let envOk = true;

if (!DB_URL || DB_URL.includes('placeholder')) {
  fail('SUPABASE_DB_URL is missing or still set to placeholder');
  envOk = false;
} else {
  ok('SUPABASE_DB_URL found');
}

if (!SUPA_URL || SUPA_URL.includes('placeholder')) {
  fail('NEXT_PUBLIC_SUPABASE_URL is missing or still set to placeholder');
  envOk = false;
} else {
  ok('NEXT_PUBLIC_SUPABASE_URL found');
}

const storageReady = SERVICE_KEY && !SERVICE_KEY.includes('placeholder') && !SERVICE_KEY.includes('PASTE');
if (!storageReady) {
  warn('SUPABASE_SERVICE_ROLE_KEY missing — will skip storage bucket setup');
} else {
  ok('SUPABASE_SERVICE_ROLE_KEY found');
}

if (!envOk) {
  console.log(`\n${R}Cannot continue — fix the missing env vars above in .env.local then re-run.${X}\n`);
  process.exit(1);
}

// ─── 2. Connect to Postgres ───────────────────────────────────────────────────

header('Connecting to database');

// Dynamic import so the error is clear if pg isn't installed
let pg;
try {
  pg = await import('pg');
} catch {
  fail('The "pg" package is not installed. Run:  npm install --save-dev pg');
  process.exit(1);
}

const { default: { Client } } = pg;

// Parse connection string manually so URL-encoded chars in the password
// don't confuse the pg driver
function parseConnStr(url) {
  const u = new URL(url);
  return {
    host:     u.hostname,
    port:     parseInt(u.port || '5432'),
    database: u.pathname.replace('/', ''),
    user:     decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl:      { rejectUnauthorized: false },
  };
}

const client = new Client(parseConnStr(DB_URL));

try {
  await client.connect();
  ok(`Connected to ${SUPA_URL}`);
} catch (err) {
  fail(`Could not connect to database: ${err.message}`);
  console.log(`\n  Make sure your SUPABASE_DB_URL is correct and the database is reachable.\n`);
  process.exit(1);
}

// ─── 3. Run migrations ────────────────────────────────────────────────────────

header('Running migrations');

const migrationsDir = join(ROOT, 'supabase', 'migrations');

// Get all .sql files sorted numerically
const migrationFiles = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

info(`Found ${migrationFiles.length} migration files`);

let ran = 0;
let skipped = 0;
let failed = 0;

for (const file of migrationFiles) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, 'utf8');

  try {
    await client.query(sql);
    ok(file);
    ran++;
  } catch (err) {
    // Some errors are safe to ignore (object already exists from a previous run)
    const safeErrors = [
      'already exists',
      'duplicate key',
      'already been done',
    ];
    const isSafe = safeErrors.some(e => err.message.toLowerCase().includes(e));

    if (isSafe) {
      warn(`${file} — skipped (already applied: ${err.message.split('\n')[0]})`);
      skipped++;
    } else {
      fail(`${file} — ERROR: ${err.message.split('\n')[0]}`);
      failed++;
    }
  }
}

console.log(`\n  Migrations: ${G}${ran} ran${X}, ${Y}${skipped} already applied${X}, ${failed > 0 ? R : ''}${failed} failed${X}`);

await client.end();

if (failed > 0) {
  console.log(`\n${R}  Some migrations failed. Check the errors above.${X}\n`);
  process.exit(1);
}

// ─── 4. Create storage buckets ────────────────────────────────────────────────

if (!storageReady) {
  warn('Skipping storage bucket setup — add SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run');
  console.log('\n  ✓  Migration phase complete. Add your service role key and re-run for storage setup.\n');
  process.exit(0);
}

header('Creating storage buckets');

const supabase = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// profile-photos (public)
try {
  const { error } = await supabase.storage.createBucket('profile-photos', {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (error && error.message.includes('already exists')) {
    warn('profile-photos bucket already exists — skipped');
  } else if (error) {
    fail(`profile-photos: ${error.message}`);
  } else {
    ok('profile-photos bucket created (public)');
  }
} catch (err) {
  fail(`profile-photos: ${err.message}`);
}

// verifications (private)
try {
  const { error } = await supabase.storage.createBucket('verifications', {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (error && error.message.includes('already exists')) {
    warn('verifications bucket already exists — skipped');
  } else if (error) {
    fail(`verifications: ${error.message}`);
  } else {
    ok('verifications bucket created (private)');
  }
} catch (err) {
  fail(`verifications: ${err.message}`);
}

// ─── 5. Apply storage RLS policies ───────────────────────────────────────────

header('Applying storage policies');

// Re-open a pg connection for the policy SQL
const client2 = new Client(parseConnStr(DB_URL));
await client2.connect();

const storagePolicies = `
-- profile-photos: anyone can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'profile-photos public read'
  ) THEN
    CREATE POLICY "profile-photos public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');
  END IF;
END $$;

-- profile-photos: users can upload to their own folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'profile-photos owner insert'
  ) THEN
    CREATE POLICY "profile-photos owner insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'profile-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- profile-photos: users can delete their own photos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'profile-photos owner delete'
  ) THEN
    CREATE POLICY "profile-photos owner delete"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'profile-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- verifications: users can upload to their own selfies folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'verifications owner insert'
  ) THEN
    CREATE POLICY "verifications owner insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'verifications'
      AND auth.uid()::text = (storage.foldername(name))[2]
    );
  END IF;
END $$;
`;

try {
  await client2.query(storagePolicies);
  ok('Storage RLS policies applied');
} catch (err) {
  warn(`Storage policies: ${err.message.split('\n')[0]}`);
}

await client2.end();

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`
${G}══════════════════════════════════════════════════${X}
${G}  RevMatch database setup complete!${X}
${G}══════════════════════════════════════════════════${X}

  Next steps:
  1. Run:  npm run dev
  2. Sign up at http://localhost:3000
  3. In Supabase dashboard → Table Editor → profiles
     set is_admin = true on your account row

`);
