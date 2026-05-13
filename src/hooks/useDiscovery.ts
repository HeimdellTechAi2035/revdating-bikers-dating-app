'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiscoveryCandidate } from '@/types/database.types';

interface UseDiscoveryOptions {
  initialCandidates: DiscoveryCandidate[];
}

export function useDiscovery({ initialCandidates }: UseDiscoveryOptions) {
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>(initialCandidates);
  const [fetching, setFetching] = useState(false);
  const [exhausted, setExhausted] = useState(initialCandidates.length === 0);
  const loadCalledFor = useRef(initialCandidates.length);

  const fetchMore = useCallback(async () => {
    if (fetching || exhausted) return;
    setFetching(true);
    try {
      const excludeParam = candidates.map((c) => c.id).join(',');
      const res = await fetch(`/api/discover/candidates?limit=10&exclude=${encodeURIComponent(excludeParam)}`);
      if (!res.ok) return;
      const data = await res.json();
      const incoming: DiscoveryCandidate[] = data.candidates ?? [];
      if (incoming.length === 0) {
        setExhausted(true);
      } else {
        setCandidates((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...incoming.filter((c) => !seen.has(c.id))];
        });
      }
    } finally {
      setFetching(false);
    }
  }, [fetching, exhausted, candidates]);

  // Auto-fetch more when deck gets low
  useEffect(() => {
    if (candidates.length < 3 && !exhausted && candidates.length !== loadCalledFor.current) {
      loadCalledFor.current = candidates.length;
      fetchMore();
    }
  }, [candidates.length, exhausted, fetchMore]);

  function removeTop() {
    setCandidates((prev) => prev.slice(1));
  }

  return { candidates, removeTop, fetchMore, fetching, exhausted };
}
