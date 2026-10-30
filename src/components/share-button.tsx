"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner"; // keep your toast lib

type Props = {
  surveyId: string;
  title?: string;
  className?: string;
};

export function ShareButton({ surveyId, title, className }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/survey/${surveyId}`
      : `/survey/${surveyId}`;

  const shareText = title
    ? `${title} — अपना वोट दें`
    : "इस सर्वे में अपना वोट दें";

  const links = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    twitter:  `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [open]);

  // Close on Escape + lock body scroll on mobile
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const prevOverflow = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      if (isMobile) document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const openPopup = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=700");
    setOpen(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("सर्वे लिंक कॉपी हो गया!");
    } catch {
      toast.info(`शेयर लिंक: ${shareUrl}`);
    }
    setOpen(false);
  };

  const handleShare = async () => {
    // On very small screens or unsupported browsers → show our sheet
    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    if (!isMobile && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: title || "डिजिटल उड़ान वोटिंग",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleShare}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          className ??
          "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-950"
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        शेयर करें
      </button>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dropdown — desktop: anchored; mobile: bottom sheet */}
      {open && (
        <div
          role="menu"
          className={[
            // base
            "z-50 rounded-xl border p-1 shadow-xl",
            "border-gray-200 bg-white ring-1 ring-black/5",
            "dark:border-gray-800 dark:bg-gray-900 dark:ring-white/10",
            // desktop: absolute anchored to button
            "sm:absolute sm:right-0 sm:mt-2 sm:w-56",
            // mobile: fixed bottom sheet
            "fixed inset-x-3 bottom-3 w-auto sm:inset-auto",
          ].join(" ")}
        >
          {/* Mobile grab handle */}
          <div className="mx-auto my-2 h-1 w-10 rounded-full bg-gray-300 sm:hidden dark:bg-gray-700" />

          <MenuItem onClick={() => openPopup(links.whatsapp)} label="WhatsApp">
            <WhatsAppIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
          </MenuItem>

          <MenuItem onClick={() => openPopup(links.telegram)} label="Telegram">
            <TelegramIcon className="h-4 w-4 text-sky-500 dark:text-sky-400" />
          </MenuItem>

          <MenuItem onClick={() => openPopup(links.twitter)} label="X / Twitter">
            <TwitterIcon className="h-4 w-4 text-gray-900 dark:text-gray-100" />
          </MenuItem>

          <MenuItem onClick={() => openPopup(links.facebook)} label="Facebook">
            <FacebookIcon className="h-4 w-4 text-blue-700 dark:text-blue-400" />
          </MenuItem>

          <MenuItem onClick={() => openPopup(links.linkedin)} label="LinkedIn">
            <LinkedInIcon className="h-4 w-4 text-sky-700 dark:text-sky-400" />
          </MenuItem>

          <div className="my-1 h-px bg-gray-100 dark:bg-gray-800" />

          <MenuItem onClick={copyToClipboard} label="लिंक कॉपी करें">
            <CopyIcon className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </MenuItem>

          {/* Mobile cancel button */}
          <div className="mt-1 border-t border-gray-100 pt-1 sm:hidden dark:border-gray-800">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800"
            >
              रद्द करें
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Menu item — dark + focus friendly ────────────────────────────────────
function MenuItem({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:bg-gray-800"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// ── Icons (unchanged) ─────────────────────────────────────────────────────
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.52 3.48A11.8 11.8 0 0 0 12.05 0C5.5 0 .18 5.32.18 11.87c0 2.09.55 4.13 1.6 5.94L0 24l6.36-1.67a11.8 11.8 0 0 0 5.69 1.45h.01c6.54 0 11.87-5.32 11.87-11.87 0-3.17-1.24-6.15-3.41-8.43zM12.05 21.8h-.01a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.8 9.8 0 0 1-1.5-5.23c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.1 1.02 6.96 2.88a9.78 9.78 0 0 1 2.88 6.96c0 5.43-4.42 9.83-9.87 9.83zm5.39-7.36c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.79-1.68-2.09-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.94 4.29 18.6 20.02c-.25 1.11-.91 1.38-1.84.86l-5.07-3.74-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.13 9.35-8.45c.4-.36-.09-.56-.63-.2L6.62 13.1 1.6 11.52c-1.09-.34-1.11-1.09.23-1.62L20.5 2.68c.91-.33 1.7.2 1.44 1.61z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.87h2.78l-.44 2.9h-2.34V22c4.78-.76 8.43-4.92 8.43-9.94z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}