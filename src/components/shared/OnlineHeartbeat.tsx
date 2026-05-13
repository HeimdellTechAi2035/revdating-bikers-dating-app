'use client';

import { useEffect } from 'react';

export default function OnlineHeartbeat() {
  useEffect(() => {
    // Ping immediately on mount, then every 60 seconds
    function ping() {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    }
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}
