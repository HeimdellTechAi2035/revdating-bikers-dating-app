'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import BlockReportSheet from '@/components/shared/BlockReportSheet';

interface Props {
  userId: string;
  displayName: string;
}

export function ProfileBlockButton({ userId, displayName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-full text-brand-chrome hover:text-white hover:bg-brand-dark-3 transition-colors"
        aria-label="Report or block user"
      >
        <MoreVertical size={20} />
      </button>

      {open && (
        <BlockReportSheet
          userId={userId}
          displayName={displayName}
          onClose={() => setOpen(false)}
          onBlocked={() => router.push('/discover')}
        />
      )}
    </>
  );
}
