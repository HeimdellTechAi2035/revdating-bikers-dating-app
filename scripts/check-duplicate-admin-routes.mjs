#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';

const adminPages = ['launch', 'photos', 'reports', 'users', 'verifications'];
const requiredCanonicalFiles = [
  'src/app/admin/(auth)/layout.tsx',
  'src/app/admin/login/page.tsx',
  ...adminPages.map((page) => `src/app/admin/(auth)/${page}/page.tsx`),
];

const duplicatePairs = adminPages.map((page) => ({
  route: `/admin/${page}`,
  canonical: `src/app/admin/(auth)/${page}/page.tsx`,
  duplicate: `src/app/admin/${page}/page.tsx`,
}));

const missingCanonical = requiredCanonicalFiles.filter((file) => !existsSync(path.resolve(file)));
const rootDuplicates = duplicatePairs.filter(({ duplicate }) => existsSync(path.resolve(duplicate)));

if (missingCanonical.length === 0 && rootDuplicates.length === 0) {
  console.log('Admin route check passed: canonical (auth) admin pages are present and no duplicate root admin pages exist.');
  process.exit(0);
}

console.error('Admin route check failed.');

if (missingCanonical.length > 0) {
  console.error('\nMissing required canonical admin files:');
  for (const file of missingCanonical) console.error(`- ${file}`);
}

if (rootDuplicates.length > 0) {
  console.error('\nDuplicate admin page files found. Route groups like (auth) do not affect URLs, so these files conflict:');
  for (const { route, canonical, duplicate } of rootDuplicates) {
    console.error(`- ${route}: keep ${canonical}; remove ${duplicate}`);
  }
}

process.exit(1);
