import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

// Configure VAPID once
if (process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:hello@revdating.co.uk',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

async function getSubscriptions(userId: string) {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  return (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
}

export async function sendPushNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return; // silently skip if not configured

  const subs = await getSubscriptions(userId);
  if (!subs.length) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? 'general',
  });

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
      ).catch((err) => {
        // 410 Gone = subscription expired/revoked — clean it up
        if (err.statusCode === 410) {
          const admin = createAdminClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          void (admin as any)
            .from('web_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }),
    ),
  );
}

// ── Notification helpers ───────────────────────────────────────────────────

export function notifyNewMatch(userId: string, matchedName: string, matchId: string) {
  return sendPushNotification(userId, {
    title: "It's a match! 🔥",
    body: `You and ${matchedName} liked each other.`,
    url: `/chat/${matchId}`,
    tag: 'new_match',
  });
}

export function notifyNewMessage(
  userId: string,
  senderName: string,
  matchId: string,
  preview: string,
) {
  return sendPushNotification(userId, {
    title: `${senderName}`,
    body: preview.length > 80 ? `${preview.slice(0, 77)}…` : preview,
    url: `/chat/${matchId}`,
    tag: `message_${matchId}`,
  });
}

export function notifyNewLike(userId: string) {
  return sendPushNotification(userId, {
    title: 'Someone liked your profile 🏍️',
    body: 'Go check who swiped right on you!',
    url: '/likes?tab=received',
    tag: 'new_like',
  });
}

export function notifyRideDateInvite(
  userId: string,
  senderName: string,
  location: string,
  rideDateId: string,
) {
  return sendPushNotification(userId, {
    title: `${senderName} wants to ride with you!`,
    body: `Ride plan: ${location}`,
    url: `/ride-dates/${rideDateId}`,
    tag: 'ride_date',
  });
}

export function notifyRideDateAccepted(
  userId: string,
  acceptorName: string,
  location: string,
  rideDateId: string,
) {
  return sendPushNotification(userId, {
    title: `${acceptorName} accepted your ride invite! 🏍️`,
    body: `Ride date confirmed at ${location}`,
    url: `/ride-dates/${rideDateId}`,
    tag: 'ride_date_accepted',
  });
}
