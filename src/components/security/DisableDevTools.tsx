'use client';

import { useEffect } from 'react';

export default function DisableDevTools() {
  useEffect(() => {
    // Block right-click context menu
    const blockContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', blockContext);

    // Block devtools keyboard shortcuts
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // F12
      if (key === 'F12') { e.preventDefault(); return; }
      // Ctrl+Shift+I / Cmd+Shift+I — DevTools
      if (ctrl && shift && (key === 'I' || key === 'i')) { e.preventDefault(); return; }
      // Ctrl+Shift+J / Cmd+Shift+J — Console
      if (ctrl && shift && (key === 'J' || key === 'j')) { e.preventDefault(); return; }
      // Ctrl+Shift+C / Cmd+Shift+C — Inspect element
      if (ctrl && shift && (key === 'C' || key === 'c')) { e.preventDefault(); return; }
      // Ctrl+U / Cmd+U — View source
      if (ctrl && (key === 'U' || key === 'u')) { e.preventDefault(); return; }
      // Ctrl+S / Cmd+S — Save page
      if (ctrl && (key === 'S' || key === 's')) { e.preventDefault(); return; }
    };

    document.addEventListener('keydown', blockKeys);

    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  return null;
}
