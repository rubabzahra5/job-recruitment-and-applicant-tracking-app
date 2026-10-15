"use client";

import { useEffect, useRef } from "react";

interface ScrollVideoProps {
  src: string;
  poster: string;
  label: string;
}

/**
 * Scroll-synced hero video. No autoplay — the video scrubs through its
 * duration as the user scrolls down the page. Fully user-controlled motion.
 */
export function ScrollVideo({ src, poster, label }: ScrollVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let raf = 0;

    const sync = () => {
      raf = 0;
      if (!video.duration || Number.isNaN(video.duration)) return;
      // Map the first ~1.2 viewports of scrolling to the full video duration.
      const scrubDistance = window.innerHeight * 1.2;
      const progress = Math.min(1, Math.max(0, window.scrollY / scrubDistance));
      const target = progress * video.duration;
      // Avoid thrashing the decoder on tiny deltas.
      if (Math.abs(video.currentTime - target) > 1 / 30) {
        try {
          video.currentTime = target;
        } catch {
          /* seek not ready yet — next scroll tick will retry */
        }
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    const onLoaded = () => sync();

    video.addEventListener("loadedmetadata", onLoaded);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Set initial frame once metadata is available.
    if (video.readyState >= 1) sync();

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      preload="auto"
      poster={poster}
      aria-label={label}
      className="h-auto w-full rounded-2xl mix-blend-screen"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
