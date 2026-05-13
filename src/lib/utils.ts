import { differenceInYears, format, formatDistanceToNow } from 'date-fns';

type ClassValue = string | number | boolean | null | undefined | ClassValue[];

// Tailwind class merging helper (lightweight, no clsx dep needed — inline)
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Age from ISO date string
export function getAge(dateOfBirth: string): number {
  return differenceInYears(new Date(), new Date(dateOfBirth));
}

// e.g. "2 hours ago"
export function timeAgo(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

// e.g. "14 Jan 2025"
export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'd MMM yyyy');
}

// e.g. "14:32"
export function formatTime(dateString: string): string {
  return format(new Date(dateString), 'HH:mm');
}

// Message timestamp: show time if today, date otherwise
export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday ? format(date, 'HH:mm') : format(date, 'd MMM');
}

// Human-readable riding style
export function formatRidingStyle(style: string): string {
  const map: Record<string, string> = {
    cruiser: 'Cruiser',
    sport: 'Sport',
    touring: 'Touring',
    adventure: 'Adventure',
    dirt: 'Dirt',
    chopper: 'Chopper',
    cafe_racer: 'Café Racer',
    bobber: 'Bobber',
    naked: 'Naked',
    scooter: 'Scooter',
    other: 'Other',
  };
  return map[style] ?? style;
}

export function formatRidingFrequency(freq: string): string {
  const map: Record<string, string> = {
    daily: 'Daily rider',
    weekly: 'Weekly',
    weekends: 'Weekends',
    monthly: 'Monthly',
    occasionally: 'Occasionally',
  };
  return map[freq] ?? freq;
}

export function formatLookingFor(val: string): string {
  const map: Record<string, string> = {
    serious_relationship: 'Serious relationship',
    casual_dating: 'Casual dating',
    riding_partner: 'Riding partner',
    friendship: 'Friendship',
    open_to_anything: 'Open to anything',
  };
  return map[val] ?? val;
}

export function formatGender(gender: string): string {
  const map: Record<string, string> = {
    man: 'Man',
    woman: 'Woman',
    non_binary: 'Non-binary',
    other: 'Other',
  };
  return map[gender] ?? gender;
}

// Distance display
export function formatDistance(km: number | null): string {
  if (km === null) return 'Unknown distance';
  if (km < 1) return '< 1 km away';
  return `${Math.round(km)} km away`;
}

export function formatDistanceMiles(miles: number | null): string {
  if (miles === null || miles === undefined) return '';
  if (miles < 1) return '< 1 mile away';
  if (miles === 1) return '1 mile away';
  return `${Math.round(miles)} miles away`;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

// Validate that user is 18+
export function isEighteenOrOlder(dateOfBirth: string): boolean {
  return differenceInYears(new Date(), new Date(dateOfBirth)) >= 18;
}

// Build Supabase Storage public URL
export function getStorageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`;
}

// Validate image file before upload
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const MAX_SIZE_MB = 10;

  // Accept any image/* type — covers JPEG, PNG, WebP, HEIC/HEIF (iPhone/Samsung), GIF, AVIF etc.
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select an image file' };
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `Image must be smaller than ${MAX_SIZE_MB}MB` };
  }

  return { valid: true };
}

// Safe JSON parse
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// Generate a unique filename for storage
export function generateStorageFileName(userId: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${userId}/${timestamp}-${random}.${extension}`;
}
