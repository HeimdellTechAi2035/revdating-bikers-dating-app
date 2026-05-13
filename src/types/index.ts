// =============================================================
// REVdating — Application-level types
// =============================================================

export * from './database.types';

// Match with joined profile info (for display)
export type MatchWithProfiles = {
  id: string;
  is_active: boolean;
  created_at: string;
  last_message_at: string | null;
  other_user: {
    id: string;
    display_name: string;
    primary_photo_url: string | null;
    last_active: string;
    is_verified: boolean;
    is_premium: boolean;
  };
  last_message: {
    content: string;
    sender_id: string;
    is_read: boolean;
    created_at: string;
  } | null;
  unread_count: number;
  you_superliked: boolean;
  they_superliked: boolean;
};

// Message with sender info
export type MessageWithSender = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  is_mine: boolean;
};

// API response wrapper
export type ApiResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// Swipe API request/response
export type SwipeRequest = {
  swiped_id: string;
  action: 'like' | 'pass' | 'rev';
};

export type SwipeResponse = {
  match: { id: string; is_new: boolean } | null;
  rev_it_credits_remaining: number | null;
  daily_swipes_remaining: number | null;
};

// Profile update payload — field names match the actual profiles table columns
export type ProfileUpdatePayload = {
  display_name?:        string;
  bio?:                 string | null;
  interested_in?:       import('./database.types').InterestedInType;
  dating_intent?:       import('./database.types').DatingIntentType | null;
  city?:                string;
  country?:             string;
  max_distance_miles?:  number;
  riding_style?:        import('./database.types').RidingStyleType | null;
  years_riding?:        number | null;
  smoker?:              boolean | null;
  drinker?:             boolean | null;
  attends_rallies?:     boolean | null;
  has_passenger_helmet?: boolean | null;
  hide_exact_location?: boolean;
  club_type?:           import('./database.types').ClubTypeType;
  club_name?:           string | null;
  // Primary bike (sent to bikes table by the API)
  bike_brand?:          string | null;
  bike_model?:          string | null;
  bike_year?:           number | null;
};

// Geolocation update
export type GeolocationUpdate = {
  lat: number;
  lng: number;
  city?: string;
  state_region?: string;
  country?: string;
};

// Admin user list item
export type AdminUserListItem = {
  id: string;
  display_name: string;
  date_of_birth: string;
  gender: import('./database.types').GenderType;
  city: string | null;
  country: string;
  is_verified: boolean;
  is_premium: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_active: string;
  photo_count: number;
  pending_photos: number;
};

// Report with joined user info
export type ReportWithUsers = {
  id: string;
  reason: import('./database.types').ReportReasonType;
  description: string | null;
  status: import('./database.types').ReportStatusType;
  created_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  reporter: { id: string; display_name: string };
  reported: { id: string; display_name: string; is_banned: boolean };
};

// Photo for moderation queue
export type PhotoForModeration = {
  id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  moderation_status: import('./database.types').ModerationStatus;
  moderation_response: Record<string, unknown> | null;
  rejected_reason: string | null;
  created_at: string;
  user: { display_name: string; is_banned: boolean };
};

// Stripe checkout
export type CheckoutRequest = {
  price_id: string;
};

// Report request
export type ReportRequest = {
  reported_id: string;
  reason: import('./database.types').ReportReasonType;
  description?: string;
};

// Block request
export type BlockRequest = {
  blocked_id: string;
};

// Image moderation result
export type ModerationResult = {
  approved: boolean;
  provider: string;
  response: Record<string, unknown>;
  rejected_reason?: string;
};

// Push notification token registration
export type PushTokenRequest = {
  token: string;
  platform: 'web' | 'ios' | 'android';
};

// Pagination
export type PaginatedResponse<T> = {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  has_more: boolean;
};
