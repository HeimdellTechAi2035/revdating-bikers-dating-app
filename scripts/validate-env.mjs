#!/usr/bin/env node

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error('Production environment validation failed.');
  console.error('Missing required environment variable(s):');
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  console.error('Set these in your deployment environment before deploying. Secret values are not printed.');
  process.exit(1);
}

console.log('Production environment validation passed. Required runtime env vars are present.');
