'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Send, ChevronLeft, ShieldCheck, Flag, Check, CheckCheck, X, MoreVertical,
  CalendarCheck, Smile, Search, Loader2, MapPin, Calendar, AlertTriangle,
} from 'lucide-react';
import BlockReportSheet from '@/components/shared/BlockReportSheet';
import { AIIcebreakerHelper } from '@/components/chat/AIIcebreakerHelper';
import { AIRidePlannerHelper } from '@/components/chat/AIRidePlannerHelper';
import { formatTime } from '@/lib/utils';
import { analytics } from '@/lib/analytics';

// Lazy-load emoji picker (browser-only, ~200 KB gzipped)
const EmojiPickerWidget = dynamic(() => import('@emoji-mart/react'), { ssr: false });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  deleted_at: string | null;
  created_at: string;
  is_mine: boolean;
}

interface OtherUser {
  id: string;
  display_name: string;
  primary_photo_url: string | null;
  last_active: string;
  is_verified: boolean;
  show_online_status: boolean;
}

interface ChatWindowProps {
  matchId: string;
  currentUserId: string;
  otherUser: OtherUser;
  initialMessages: ChatMessage[];
}

interface GifResult {
  id: string;
  title: string;
  url: string;
  preview_url: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_PROMPTS = [
  'Fancy a ride this weekend?',
  'What do you ride?',
  'Coffee stop or long ride?',
  'Best route near you?',
] as const;

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam',       label: 'Spam' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'other',      label: 'Other' },
] as const;

type MessageSafetyRiskLevel = 'low' | 'medium' | 'high';

type MessageSafetyCategory =
  | 'harassment'
  | 'threat'
  | 'hate_or_abuse'
  | 'sexual_pressure'
  | 'money_request'
  | 'suspicious_link'
  | 'scam_like'
  | 'manipulation'
  | 'personal_contact_pressure'
  | 'unsafe_meetup_pressure'
  | 'self_harm_or_crisis'
  | 'other';

type MessageSafetyResult = {
  safe_to_send: boolean;
  risk_level: MessageSafetyRiskLevel;
  categories: MessageSafetyCategory[];
  warning: string | null;
  suggested_rewrite: string | null;
};

type MessageSafetyWarning = {
  content: string;
  result: MessageSafetyResult;
};

const MESSAGE_SAFETY_CATEGORY_LABELS: Record<MessageSafetyCategory, string> = {
  harassment: 'Harassment',
  threat: 'Threat',
  hate_or_abuse: 'Hate or abuse',
  sexual_pressure: 'Sexual pressure',
  money_request: 'Money request',
  suspicious_link: 'Suspicious link',
  scam_like: 'Scam-like',
  manipulation: 'Manipulation',
  personal_contact_pressure: 'Personal contact pressure',
  unsafe_meetup_pressure: 'Unsafe meetup pressure',
  self_harm_or_crisis: 'Self-harm or crisis',
  other: 'Other risk',
};

// ---------------------------------------------------------------------------
// Content parser — detects GIF messages stored as JSON
// ---------------------------------------------------------------------------

type ParsedContent =
  | { type: 'text'; text: string }
  | { type: 'gif'; url: string; title: string }
  | { type: 'ride_invite'; id: string; location: string; scheduled_time: string };

function shouldCheckMessageSafety(content: string): boolean {
  if (content.startsWith('{"type":"')) return false;
  return true;
}

async function checkMessageSafety(message: string): Promise<MessageSafetyResult | null> {
  try {
    const res = await fetch('/api/ai/message-safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) return null;

    const data = await res.json() as MessageSafetyResult;
    if (!['low', 'medium', 'high'].includes(data.risk_level)) return null;
    return data;
  } catch {
    return null;
  }
}

function parseContent(content: string): ParsedContent {
  if (content.startsWith('{"type":"')) {
    try {
      const p = JSON.parse(content);
      if (p.type === 'gif' && typeof p.url === 'string') {
        return { type: 'gif', url: p.url, title: p.title ?? '' };
      }
      if (p.type === 'ride_invite' && p.id && p.location && p.scheduled_time) {
        return { type: 'ride_invite', id: p.id, location: p.location, scheduled_time: p.scheduled_time };
      }
    } catch { /* fall through */ }
  }
  return { type: 'text', text: content };
}

// ---------------------------------------------------------------------------
// Read tick
// ---------------------------------------------------------------------------

function ReadTick({ isRead }: { isRead: boolean }) {
  return isRead
    ? <CheckCheck size={11} className="text-white/90 shrink-0" />
    : <Check      size={11} className="text-white/40 shrink-0" />;
}

// ---------------------------------------------------------------------------
// Date separator label
// ---------------------------------------------------------------------------

function getDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now  = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// GIF picker panel
// ---------------------------------------------------------------------------

function GifPanel({
  onSelect,
  onClose,
}: {
  onSelect: (url: string, title: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery]   = useState('');
  const [gifs, setGifs]     = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGifs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/gifs${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      const data = await res.json();
      setGifs(data.gifs ?? []);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  // Load trending on mount
  useEffect(() => { loadGifs(''); }, [loadGifs]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { if (query) loadGifs(query); }, 450);
    return () => clearTimeout(t);
  }, [query, loadGifs]);

  return (
    <div className="bg-brand-dark-2 border-t border-brand-dark-4 flex flex-col" style={{ height: 280 }}>
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="flex-1 flex items-center gap-2 bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-3 py-2">
          <Search size={13} className="text-brand-chrome shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs…"
            className="flex-1 bg-transparent text-sm outline-none placeholder-brand-chrome/50"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-brand-chrome hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-brand-chrome hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-brand-chrome" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-brand-chrome text-sm">
            No GIFs found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif.url, gif.title)}
                className="relative rounded-xl overflow-hidden bg-brand-dark-4 aspect-video hover:opacity-75 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview_url || gif.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-brand-chrome/30 pb-1.5">Powered by GIPHY</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report modal
// ---------------------------------------------------------------------------

function ReportModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const [reason, setReason]         = useState('harassment');
  const [description, setDesc]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]             = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await fetch(`/api/messages/${messageId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description: description || undefined }),
      });
      setDone(true);
      setTimeout(onClose, 1800);
    } finally { setSubmitting(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-brand-dark-2 border border-brand-dark-4 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-bold text-lg">Report submitted</p>
            <p className="text-brand-chrome text-sm mt-1">We will review this message shortly.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Report Message</h3>
              <button onClick={onClose} className="text-brand-chrome hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-brand-chrome text-sm mb-3">Why are you reporting this message?</p>

            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    reason === r.value
                      ? 'border-brand-orange bg-brand-orange/10 text-white'
                      : 'border-brand-dark-4 text-brand-chrome hover:border-brand-dark-3 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
              maxLength={500}
              className="w-full bg-brand-dark-3 border border-brand-dark-4 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-brand-orange/50 mb-4"
            />

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatWindow({
  matchId,
  currentUserId,
  otherUser,
  initialMessages,
}: ChatWindowProps) {
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMessages);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [showPrompts, setShowPrompts]         = useState(initialMessages.length === 0);
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [reportingId, setReportingId]         = useState<string | null>(null);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<MessageSafetyWarning | null>(null);

  // Emoji picker
  const [showEmoji, setShowEmoji]     = useState(false);
  const [emojiData, setEmojiData]     = useState<unknown>(null);

  // GIF picker
  const [showGif, setShowGif]         = useState(false);

  // ICK
  const [showIck, setShowIck]         = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const supabase    = useRef(createClient()).current;

  const isOnline =
    otherUser.show_online_status &&
    otherUser.last_active
      ? Date.now() - new Date(otherUser.last_active).getTime() < 5 * 60 * 1000
      : false;

  // -- Lazy-load emoji data when picker opens --------------------------------

  useEffect(() => {
    if (showEmoji && !emojiData) {
      import('@emoji-mart/data').then((m) => setEmojiData(m.default));
    }
  }, [showEmoji, emojiData]);

  // -- Scroll ----------------------------------------------------------------

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => { scrollToBottom('instant'); }, []);
  useEffect(() => { scrollToBottom(); }, [messages.length]);

  // -- Mark messages read ---------------------------------------------------

  const markRead = useCallback(() => {
    void supabase.rpc('mark_messages_read', { p_match_id: matchId });
  }, [supabase, matchId]);

  // -- Realtime subscription ------------------------------------------------

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const raw = payload.new as Omit<ChatMessage, 'is_mine'>;
          const enriched: ChatMessage = { ...raw, is_mine: raw.sender_id === currentUserId };
          setMessages((prev) => {
            if (prev.some((m) => m.id === enriched.id)) return prev;
            return [...prev, enriched];
          });
          if (raw.sender_id !== currentUserId) markRead();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const updated = payload.new as { id: string; is_read: boolean; read_at: string | null };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...m, is_read: updated.is_read, read_at: updated.read_at } : m,
            ),
          );
        },
      )
      .on('broadcast', { event: 'ick' }, () => {
        setShowIck(true);
        setTimeout(() => setShowIck(false), 3000);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [matchId, currentUserId, supabase, markRead]);

  // -- Send message ---------------------------------------------------------

  const sendMessage = useCallback(
    async (text?: string, options: { skipSafetyCheck?: boolean } = {}) => {
      const content = (text ?? input).trim();
      if (!content || sending) return;

      setSending(true);

      if (!options.skipSafetyCheck && shouldCheckMessageSafety(content)) {
        const safety = await checkMessageSafety(content);
        if (safety && !safety.safe_to_send && safety.risk_level !== 'low') {
          setInput(content);
          setShowPrompts(false);
          setSafetyWarning({ content, result: safety });
          setSending(false);
          textareaRef.current?.focus();
          return;
        }
      }

      setInput('');
      setShowPrompts(false);
      setSafetyWarning(null);

      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        match_id: matchId,
        sender_id: currentUserId,
        content,
        is_read: false,
        read_at: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        is_mine: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, content }),
        });

        if (res.ok) {
          const data = await res.json() as { message: Omit<ChatMessage, 'is_mine'> };
          setMessages((prev) =>
            prev.map((m) => m.id === tempId ? { ...data.message, is_mine: true } : m),
          );
          analytics.firstMessageSent();
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setInput(content);
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(content);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [input, sending, matchId, currentUserId],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function useIcebreakerMessage(message: string) {
    setSafetyWarning(null);
    setInput(message);
    setShowPrompts(false);
    setShowEmoji(false);
    setShowGif(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // -- Emoji select ---------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleEmojiSelect(emoji: any) {
    const native: string = emoji.native ?? '';
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? input.length;
      const end   = textarea.selectionEnd   ?? input.length;
      const next  = input.slice(0, start) + native + input.slice(end);
      setInput(next);
      setTimeout(() => {
        textarea.focus();
        const pos = start + native.length;
        textarea.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setInput((prev) => prev + native);
    }
    setShowEmoji(false);
  }

  // -- GIF select -----------------------------------------------------------

  async function handleGifSelect(url: string, title: string) {
    setShowGif(false);
    await sendMessage(JSON.stringify({ type: 'gif', url, title }));
  }

  // -- ICK ------------------------------------------------------------------

  async function handleIck() {
    // Show on my screen immediately
    setShowIck(true);
    setTimeout(() => setShowIck(false), 3000);

    // Broadcast to the other user's screen via realtime
    if (channelRef.current) {
      void channelRef.current.send({ type: 'broadcast', event: 'ick', payload: {} });
    }

    // File report to admin — flags the other user for monitoring
    void fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reported_id: otherUser.id,
        reason:      'harassment',
        description: 'ICK button pressed in chat — flagged for monitoring',
      }),
    });
  }

  // -- Build list with date separators --------------------------------------

  type ListItem =
    | { type: 'date'; label: string }
    | { type: 'msg'; msg: ChatMessage };

  const listItems: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const label = getDateLabel(msg.created_at);
    if (label !== lastDate) {
      listItems.push({ type: 'date', label });
      lastDate = label;
    }
    listItems.push({ type: 'msg', msg });
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div
      className="flex flex-col h-full bg-brand-dark"
      onClick={() => { setSelectedId(null); setShowEmoji(false); }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-4 bg-brand-dark-2 shrink-0">
        <Link
          href="/matches"
          className="p-1 -ml-1 text-brand-chrome hover:text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </Link>

        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-dark-4">
            {otherUser.primary_photo_url ? (
              <Image
                src={otherUser.primary_photo_url}
                alt={otherUser.display_name}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg">🏍️</div>
            )}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-brand-dark-2" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold truncate">{otherUser.display_name}</span>
            {otherUser.is_verified && (
              <ShieldCheck size={14} className="shrink-0 text-blue-400" />
            )}
          </div>
          <p className="text-xs text-brand-chrome">
            {isOnline ? 'Online now' : 'Active recently'}
          </p>
        </div>

        <Link
          href={`/ride-dates/new/${matchId}`}
          className="p-2 text-brand-chrome hover:text-brand-orange transition-colors"
          aria-label="Plan a ride date"
          title="Plan a ride date"
        >
          <CalendarCheck size={20} />
        </Link>

        <button
          onClick={() => setShowBlockReport(true)}
          className="p-2 text-brand-chrome hover:text-white transition-colors"
          aria-label="More options"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* ── Message list ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {listItems.length === 0 && (
          <div className="text-center text-brand-chrome text-sm py-12">
            Say hi to {otherUser.display_name}! 🏍️
          </div>
        )}

        {listItems.map((item, idx) => {
          if (item.type === 'date') {
            return (
              <div key={`date-${idx}`} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-brand-dark-4" />
                <span className="text-xs text-brand-chrome/70 shrink-0 font-medium">{item.label}</span>
                <div className="flex-1 h-px bg-brand-dark-4" />
              </div>
            );
          }

          const { msg } = item;
          const parsed    = parseContent(msg.content);
          const isSelected = selectedId === msg.id;

          return (
            <div key={msg.id} className={`flex mb-2 ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
              <div className="relative max-w-[78%]">
                {/* Report tooltip */}
                {isSelected && !msg.is_mine && (
                  <div className="absolute -top-10 left-0 z-20 flex gap-1 bg-brand-dark-2 border border-brand-dark-4 rounded-xl px-2 py-1.5 shadow-xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportingId(msg.id);
                        setSelectedId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Flag size={12} />
                      Report
                    </button>
                  </div>
                )}

                {/* Ride invite card */}
                {parsed.type === 'ride_invite' ? (
                  <Link
                    href={`/ride-dates/${parsed.id}`}
                    className={`block rounded-2xl overflow-hidden border transition-colors ${
                      msg.is_mine
                        ? 'border-brand-orange/40 bg-brand-orange/10 hover:bg-brand-orange/20'
                        : 'border-brand-dark-4 bg-brand-dark-3 hover:border-brand-orange/40'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-4 pt-3 pb-1">
                      <div className="flex items-center gap-1.5 text-brand-orange text-xs font-semibold mb-2">
                        <CalendarCheck size={13} />
                        Ride Date Invite
                      </div>
                      <div className="flex items-start gap-2 mb-1">
                        <MapPin size={13} className="text-brand-chrome shrink-0 mt-0.5" />
                        <span className="text-sm font-medium leading-snug">{parsed.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-brand-chrome shrink-0" />
                        <span className="text-xs text-brand-chrome">
                          {new Date(parsed.scheduled_time).toLocaleString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-brand-orange mt-2 font-medium">Tap to view &amp; respond →</p>
                    </div>
                    <div className={`flex items-center gap-1 px-4 py-1.5 ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] tabular-nums text-brand-chrome/50">
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.is_mine && <ReadTick isRead={msg.is_read} />}
                    </div>
                  </Link>
                ) : parsed.type === 'gif' ? (
                  <div
                    className={`rounded-2xl overflow-hidden ${
                      msg.is_mine ? 'rounded-br-sm' : 'rounded-bl-sm'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!msg.is_mine) setSelectedId(isSelected ? null : msg.id);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={parsed.url}
                      alt={parsed.title}
                      className="max-w-full max-h-52 object-cover rounded-2xl"
                      loading="lazy"
                    />
                    <div className={`flex items-center gap-1 px-2 py-1 ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] tabular-nums text-brand-chrome/60">
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.is_mine && <ReadTick isRead={msg.is_read} />}
                    </div>
                  </div>
                ) : (
                  /* Text bubble */
                  <button
                    className={`block w-full text-left px-4 py-2.5 rounded-2xl transition-opacity ${
                      msg.is_mine
                        ? 'bg-brand-orange text-white rounded-br-sm'
                        : 'bg-brand-dark-3 text-white rounded-bl-sm'
                    } ${isSelected ? 'opacity-80' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!msg.is_mine) setSelectedId(isSelected ? null : msg.id);
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {parsed.text}
                    </p>
                    <div className={`flex items-center gap-1 mt-1 ${msg.is_mine ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] tabular-nums ${msg.is_mine ? 'text-white/50' : 'text-white/40'}`}>
                        {formatTime(msg.created_at)}
                      </span>
                      {msg.is_mine && <ReadTick isRead={msg.is_read} />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts ──────────────────────────────────────── */}
      {showPrompts && !showGif && !showEmoji && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void sendMessage(prompt)}
              className="shrink-0 text-xs px-3 py-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 transition-colors whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* ── Emoji picker panel ─────────────────────────────────── */}
      {showEmoji && (
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {emojiData ? (
            <EmojiPickerWidget
              data={emojiData}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={2}
            />
          ) : (
            <div className="flex items-center justify-center h-20 text-brand-chrome">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ── GIF picker panel ───────────────────────────────────── */}
      {showGif && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <GifPanel
            onSelect={handleGifSelect}
            onClose={() => setShowGif(false)}
          />
        </div>
      )}

      {/* ── AI icebreakers ─────────────────────────────────────── */}
      <AIIcebreakerHelper matchId={matchId} onUseMessage={useIcebreakerMessage} />

      {/* ── AI ride date planner ────────────────────────────────── */}
      <AIRidePlannerHelper matchId={matchId} onUseMessage={useIcebreakerMessage} />

      {/* ── AI safety warning ───────────────────────────────────── */}
      {safetyWarning && (
        <div className="shrink-0 px-3 py-3 bg-brand-dark-2 border-t border-brand-dark-4">
          <div className={`rounded-2xl border p-3 ${
            safetyWarning.result.risk_level === 'high'
              ? 'border-red-500/50 bg-red-500/10'
              : 'border-amber-400/50 bg-amber-400/10'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={18}
                className={safetyWarning.result.risk_level === 'high' ? 'text-red-400 shrink-0 mt-0.5' : 'text-amber-300 shrink-0 mt-0.5'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {safetyWarning.result.risk_level === 'high' ? 'Message blocked for safety' : 'Pause before sending'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-brand-chrome">
                  {safetyWarning.result.warning ?? 'This message may feel unsafe or pressuring. Edit it before sending.'}
                </p>
                {safetyWarning.result.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {safetyWarning.result.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-chrome"
                      >
                        {MESSAGE_SAFETY_CATEGORY_LABELS[category]}
                      </span>
                    ))}
                  </div>
                )}
                {safetyWarning.result.suggested_rewrite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInput(safetyWarning.result.suggested_rewrite ?? safetyWarning.content);
                      setSafetyWarning(null);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    className="mt-2 text-left text-xs text-brand-orange hover:text-brand-orange/80"
                  >
                    Use suggested rewrite: “{safetyWarning.result.suggested_rewrite}”
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setInput(safetyWarning.content);
                  setSafetyWarning(null);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                className="flex-1 rounded-xl border border-brand-dark-4 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-dark-3"
              >
                Edit message
              </button>
              {safetyWarning.result.risk_level === 'medium' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const content = safetyWarning.content;
                    setSafetyWarning(null);
                    void sendMessage(content, { skipSafetyCheck: true });
                  }}
                  disabled={sending}
                  className="flex-1 rounded-xl bg-brand-orange px-3 py-2 text-xs font-semibold text-white hover:bg-brand-orange/90 disabled:opacity-40"
                >
                  Send anyway
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ICK strip ──────────────────────────────────────────── */}
      <div className="flex items-center px-3 pt-2 pb-0 shrink-0 bg-brand-dark-2 border-t border-brand-dark-4">
        <button
          onClick={(e) => { e.stopPropagation(); void handleIck(); }}
          className="text-[11px] font-black tracking-[0.2em] px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          aria-label="Send ICK report"
        >
          ICK
        </button>
        <p className="ml-2 text-[10px] text-brand-chrome/40">Reports & flags this user to admin</p>
      </div>

      {/* ── Input bar ──────────────────────────────────────────── */}
      <div className="flex items-end gap-2 px-3 py-3 bg-brand-dark-2 shrink-0">
        {/* Emoji button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowGif(false);
            setShowEmoji((v) => !v);
          }}
          className={`p-2 rounded-full transition-colors shrink-0 ${
            showEmoji
              ? 'text-brand-orange bg-brand-orange/10'
              : 'text-brand-chrome hover:text-white'
          }`}
          aria-label="Emoji picker"
        >
          <Smile size={20} />
        </button>

        {/* GIF button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowEmoji(false);
            setShowGif((v) => !v);
          }}
          className={`shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
            showGif
              ? 'border-brand-orange text-brand-orange bg-brand-orange/10'
              : 'border-brand-dark-4 text-brand-chrome hover:text-white hover:border-brand-dark-3'
          }`}
          aria-label="GIF picker"
        >
          GIF
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (safetyWarning) setSafetyWarning(null);
          }}
          onFocus={() => {
            if (messages.length === 0) setShowPrompts(true);
            setShowEmoji(false);
            setShowGif(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          maxLength={2000}
          className="flex-1 bg-brand-dark-3 border border-brand-dark-4 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-brand-orange/50 max-h-32 overflow-y-auto leading-relaxed"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />

        <button
          onClick={() => void sendMessage()}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full bg-brand-orange flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-brand-orange/90 transition-colors"
          aria-label="Send message"
        >
          <Send size={16} className="text-white translate-x-0.5" />
        </button>
      </div>

      {/* ── ICK overlay ────────────────────────────────────────── */}
      {showIck && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm pointer-events-none select-none">
          <p
            className="text-[clamp(80px,22vw,140px)] leading-none font-black text-red-500"
            style={{ textShadow: '0 0 80px rgba(239,68,68,0.9), 0 0 40px rgba(239,68,68,0.6)' }}
          >
            ICK!
          </p>
          <p className="text-white/50 text-sm mt-5 font-medium tracking-widest uppercase">
            Reported to admin
          </p>
        </div>
      )}

      {/* ── Report modal ───────────────────────────────────────── */}
      {reportingId && (
        <ReportModal messageId={reportingId} onClose={() => setReportingId(null)} />
      )}

      {/* ── Block / Report user sheet ──────────────────────────── */}
      {showBlockReport && (
        <BlockReportSheet
          userId={otherUser.id}
          displayName={otherUser.display_name}
          onClose={() => setShowBlockReport(false)}
          onBlocked={() => { window.location.href = '/matches'; }}
        />
      )}
    </div>
  );
}
