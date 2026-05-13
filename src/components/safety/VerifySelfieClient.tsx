'use client';

import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, ArrowLeft, CheckCircle, Upload } from 'lucide-react';

export default function VerifySelfieClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile]     = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10 MB');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return toast.error('Please select a selfie first');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('selfie', file);

      const res = await fetch('/api/verifications/selfie', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 422) {
          // Face check failed — clear the photo so the user picks a new one
          setPreview(null);
          setFile(null);
        }
        throw new Error(json.error ?? 'Upload failed');
      }

      toast.success('Selfie submitted — our team will review it shortly');
      router.push('/safety');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 py-4 space-y-6 pb-10">
      <div>
        <Link href="/safety" className="flex items-center gap-1.5 text-brand-chrome text-sm mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Safety
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <Camera className="w-6 h-6 text-brand-orange" />
          <h1 className="text-xl font-bold">Selfie Verification</h1>
        </div>
        <p className="text-brand-chrome text-sm">
          Upload a clear selfie of your face to confirm you&apos;re a real person.
          Our team reviews it manually — usually within 24 hours.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-brand-chrome uppercase tracking-wider">Tips for a good selfie</p>
        {[
          'Remove your helmet, sunglasses, and any face coverings',
          'Face the camera directly in good lighting',
          'No filters — clear, natural photo',
          'Once approved, a ✓ verified badge appears on your profile',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-brand-orange mt-0.5 flex-shrink-0" />
            <p className="text-sm text-brand-chrome">{step}</p>
          </div>
        ))}
      </div>

      {/* Upload area */}
      <div>
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Selfie preview"
              className="w-full max-h-72 object-cover rounded-2xl border border-brand-dark-4"
            />
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="w-full py-2.5 rounded-xl border border-brand-dark-4 text-sm text-brand-chrome hover:border-brand-orange/50 transition-colors"
            >
              Choose a different photo
            </button>
          </div>
        ) : (
          <label className="relative w-full py-10 rounded-2xl border-2 border-dashed border-brand-dark-4 hover:border-brand-orange/50 transition-colors flex flex-col items-center gap-3 cursor-pointer overflow-hidden">
            <Upload className="w-8 h-8 text-brand-chrome pointer-events-none" />
            <div className="text-center pointer-events-none">
              <p className="font-semibold text-sm">Tap to take or upload a selfie</p>
              <p className="text-brand-chrome text-xs mt-0.5">JPG, PNG or WebP · max 10 MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!file || loading}
        className="w-full py-3.5 rounded-2xl bg-brand-orange text-white font-bold text-base hover:bg-brand-orange/90 transition-colors disabled:opacity-40"
      >
        {loading ? 'Uploading…' : 'Submit selfie for review'}
      </button>

      <p className="text-brand-chrome text-xs text-center">
        By submitting, you confirm this is a genuine photo of yourself.
        We do not use your selfie for any purpose other than identity verification.
      </p>
    </div>
  );
}
