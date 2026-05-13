'use client';

import { useEffect, useRef } from 'react';

interface UseGeolocationOptions {
  onSuccess?: (coords: GeolocationCoordinates) => void;
  onError?: (err: GeolocationPositionError) => void;
}

export function useGeolocation({ onSuccess, onError }: UseGeolocationOptions = {}) {
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    async function updateServer(coords: GeolocationCoordinates) {
      await fetch('/api/geolocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });
    }

    // Get initial position once
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateServer(pos.coords);
        onSuccess?.(pos.coords);
      },
      (err) => onError?.(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);
}
