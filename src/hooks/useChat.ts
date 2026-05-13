'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

type Message = Database['public']['Tables']['messages']['Row'];

export function useChat(matchId: string, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  const send = useCallback(async (content: string) => {
    if (!content.trim() || sending) return false;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, content }),
      });
      return res.ok;
    } finally {
      setSending(false);
    }
  }, [matchId, sending]);

  return { messages, send, sending };
}
