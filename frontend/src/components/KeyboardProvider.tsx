"use client";

/*
 * Issues:
 *  1. Focus mode does not highlight audio upload button
 *  2. No way to change volume on player screen
 *  3. Keybindings does not work on create rubric popup
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type WaveSurfer from "wavesurfer.js";

// Shift+Key → page mapping
const SHIFT_ROUTES: Record<string, string> = {
  S: "/search",
  L: "/library",
  C: "/classes",
  A: "/analytics",
  D: "/dashboard",
  P: "/profile",
};

export default function KeyboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusables, setFocusables] = useState<HTMLElement[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ----------------------------
     Helpers
  ----------------------------- */
  const getFocusableElements = () => {
    const all = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a, [role='button'], input:not([type='hidden']), textarea"
      )
    ).filter(el => !el.hasAttribute("disabled"));

    // Skip any elements inside the header
    const header = document.querySelector("header");
    if (!header) return all;

    return all.filter(el => !header.contains(el));
  };

  /* ----------------------------
     Highlight active element
  ----------------------------- */
  useEffect(() => {
    if (!isFocusMode || focusables.length === 0) return;

    focusables.forEach(el => el.classList.remove("focus-highlight"));
    const active = focusables[focusedIndex];
    active?.classList.add("focus-highlight");
    active?.scrollIntoView({ block: "center" });
  }, [isFocusMode, focusedIndex, focusables]);

  /* ----------------------------
     Keyboard handling
  ----------------------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      /* ----------------------------
         ESC KEY
      ----------------------------- */
      if (e.key === "Escape") {
        if (isFocusMode) {
          e.preventDefault();
          focusables.forEach(el => el.classList.remove("focus-highlight"));
          setIsFocusMode(false);
          return;
        }
        if (isTyping) {
          e.preventDefault();
          target.blur();
          return;
        }
      }

      /* ----------------------------
         SHIFT+KEY GLOBAL SHORTCUTS
      ----------------------------- */
      if (e.shiftKey && !isTyping) {
        const route = SHIFT_ROUTES[e.key.toUpperCase()];
        if (route) {
          e.preventDefault();
          if (pathname !== route) router.push(route);
          return;
        }

        if (e.key.toUpperCase() === "Q") {
          e.preventDefault();
          const signOutButton = Array.from(
            document.querySelectorAll<HTMLButtonElement>(".auth-button")
          ).find(btn => btn.textContent?.trim().includes("Sign out"));
          signOutButton?.click();
          setIsFocusMode(false);
          return;
        }
      }

      /* ----------------------------
         Focus mode shortcuts
      ----------------------------- */
      if (isFocusMode) {
        e.preventDefault();
        const active = focusables[focusedIndex];
        if (!active) return;

        switch (e.key) {
          case "k":
            setFocusedIndex(i => (i - 1 + focusables.length) % focusables.length);
            break;
          case "j":
            setFocusedIndex(i => (i + 1) % focusables.length);
            break;
          case "Enter":
            if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
              (active as HTMLInputElement | HTMLTextAreaElement).focus();
            } else {
              active.click();
            }
            focusables.forEach(el => el.classList.remove("focus-highlight"));
            setIsFocusMode(false);
            break;
        }
        return;
      }

      /* ----------------------------
         Toggle focus mode with f
      ----------------------------- */
      if (e.key === "f" && !isTyping && !isFocusMode) {
        e.preventDefault();
        const els = getFocusableElements();
        if (els.length === 0) return;
        setFocusables(els);
        setFocusedIndex(0);
        setIsFocusMode(true);
        return;
      }

      /* ----------------------------
         PLAYER SCREEN SHORTCUTS
      ----------------------------- */
      if (!isTyping && !isFocusMode && pathname.startsWith("/player")) {
        const ws: WaveSurfer | null = (window as any).wavesurferInstance;
        const playButton = document.querySelector<HTMLButtonElement>(".play-btn");

        switch (e.key) {
          case " ":
            e.preventDefault();
            if (ws) ws.playPause();
            else playButton?.click();
            break;

          case ">":
          case ".":
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() + 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.min(time / duration, 1));
            }
            break;

          case "<":
          case ",":
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() - 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.max(time / duration, 0));
            }
            break;
        }
      }

      /* ----------------------------
         PAGE NAVIGATION OUTSIDE FOCUS MODE
      ----------------------------- */
      if (!isTyping && !isFocusMode) {
        switch (e.key) {
          case "j":
            e.preventDefault();
            window.scrollBy({ top: 120, behavior: "smooth" });
            break;
          case "k":
            e.preventDefault();
            window.scrollBy({ top: -120, behavior: "smooth" });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, router, isFocusMode, focusables, focusedIndex]);

  return (
    <>
      {isFocusMode && <div className="focus-overlay" />}
      {children}
    </>
  );
}
