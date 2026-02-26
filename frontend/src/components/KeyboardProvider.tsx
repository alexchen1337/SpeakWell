"use client";

/*
 * Issues:
 *  1. Focus mode does not recognize audio upload button
 *  2. No way to change volume on player screen
 */

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type WaveSurfer from "wavesurfer.js";

// Shift+Key Page Mapping
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
  const prevPathRef = useRef<string | null>(null);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusables, setFocusables] = useState<HTMLElement[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [lastFocusedByScope, setLastFocusedByScope] = useState<Record<string, number>>({});

  /*
   * Reset Focus Mode when route changes
   */
  useEffect(() => {
      if (prevPathRef.current && prevPathRef.current !== pathname) {
        // Clear stored focus index when leaving a screen
        setLastFocusedByScope({});
        setIsFocusMode(false);
      }

      prevPathRef.current = pathname;
  }, [pathname]);

  const getActiveModal = (): HTMLElement | null => {
      return document.querySelector<HTMLElement>(".modal-content");
  };

  /*
   * Get every element on screen that is selectable in Focus Mode
   */
  const getFocusableElements = () => {
    const modal = getActiveModal();
    const root: ParentNode = modal ?? document;

    const all = Array.from(
      root.querySelectorAll<HTMLElement>(
        "button, a, [role='button'], input:not([type='hidden']), textarea"
      )
    ).filter(el => !el.hasAttribute("disabled"));

    if (!modal) {
        const header = document.querySelector("header");
        if (header) {
            return all.filter(el => !header.contains(el));
        }
    }
    return all;

        /*
    // Skip any elements inside the header
    const header = document.querySelector("header");
    if (!header) return all;

    return all.filter(el => !header.contains(el));
    */
  };

  /* 
  * Highlight focused element 
  */
  useEffect(() => {
    if (!isFocusMode || focusables.length === 0) return;

    focusables.forEach(el => el.classList.remove("focus-highlight"));
    const active = focusables[focusedIndex];

    active?.classList.add("focus-highlight");
    active?.scrollIntoView({ block: "center" });
  }, [isFocusMode, focusedIndex, focusables]);

  /* 
   * Keyboard handling
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      const modal = getActiveModal();

      // ESC Key
      if (e.key === "Escape") {
        if (isTyping) {
          e.preventDefault();

          // Exit text box
          target.blur();
          return;
        }
        if (isFocusMode) {          
          e.preventDefault();

          const modal = getActiveModal();
          const scopeKey = modal ? 'modal' : pathname;

          // Save the last focused element
          setLastFocusedByScope(prev => ({
              ...prev,
              [scopeKey]: focusedIndex
          }));

          // Exit Focus Mode
          focusables.forEach(el => el.classList.remove("focus-highlight"));
          setIsFocusMode(false);
          return;
        }
        if (modal) {
          e.preventDefault();

          // Close modal
          const overlay = modal.parentElement;
          overlay?.dispatchEvent(
            new MouseEvent("click", { bubbles: true })
          );

          // Reset modal focus index
          setLastFocusedByScope(prev => {
           const next = { ...prev};
           delete next['modal'];
           return next;
          });

          // Exit Focus Mode
          setIsFocusMode(false);
          return;
        }
      }

      /* 
       * Shift+Key Global Shortcuts
       */
      if (e.shiftKey && !isTyping) {
        // Jump to screen in SHIFT_ROUTES
        //    (S)earch
        //    (L)ibrary
        //    (C)lasses
        //    (A)nalytics
        //    (D)ashboard
        //    (P)rofile
        const route = SHIFT_ROUTES[e.key.toUpperCase()];
        if (route) {
          e.preventDefault();
          if (pathname !== route) router.push(route);
          return;
        }

        // Sign out (Q)
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

      /* 
       * Focus mode shortcuts
       */
      if (isFocusMode) {
        e.preventDefault();
        const active = focusables[focusedIndex];
        if (!active) return;

        switch (e.key) {
          case "j":
            // Jump to next focusable element (j)
            setFocusedIndex(i => (i + 1) % focusables.length);
            break;
          case "k":
            // Jump to previous focusable element (k)
            setFocusedIndex(i => (i - 1 + focusables.length) % focusables.length);
            break;
          case "Enter":
            // Save the last focused element
            const modal = getActiveModal();
            const scopeKey = modal ? 'modal' : pathname;

            setLastFocusedByScope(prev => ({
                ...prev,
                [scopeKey]: focusedIndex
            }));

            if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
              (active as HTMLInputElement | HTMLTextAreaElement).focus();
            } else {
              // Select focused element (Enter)
              active.click();
            }

            focusables.forEach(el => el.classList.remove("focus-highlight"));
            setIsFocusMode(false);
            break;
        }
        return;
      }

      // Enter Focus Mode (f)
      if (e.key === "f" && !isTyping && !isFocusMode) {
        e.preventDefault();

        const els = getFocusableElements();
        if (els.length === 0) return;

        setFocusables(els);

        const modal = getActiveModal();
        const scopeKey = modal ? 'modal' : pathname;

        if (modal) {
          const modalFocusables = els.filter(el => modal.contains(el));
          setFocusables(modalFocusables);
        
          const savedIndex = lastFocusedByScope['modal'];
          setFocusedIndex(
            savedIndex !== undefined && savedIndex < modalFocusables.length
            ? savedIndex
            : 1         // 1st element is the exit button. It is
                        // more logical to default to 2nd element.
          );
        } else {
            setFocusables(els);
        
            const savedIndex = lastFocusedByScope[scopeKey];
            setFocusedIndex(
                savedIndex !== undefined && savedIndex < els.length
                ? savedIndex
                : 0
            );
        }

        setIsFocusMode(true);
        return;
      }

      /* 
       * Player Screen Shortcuts
       */
      if (!isTyping && !isFocusMode && pathname.startsWith("/player")) {
        const ws: WaveSurfer | null = (window as any).wavesurferInstance;
        const playButton = document.querySelector<HTMLButtonElement>(".play-btn");

        switch (e.key) {
          case " ":
            // Pause/play (Space)
            e.preventDefault();
            if (ws) ws.playPause();
            else playButton?.click();
            break;

          case ">":
          case ".":
            // Fast forward 10s (. or >)
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() + 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.min(time / duration, 1));
            }
            break;

          case "<":
          case ",":
            // Rewind 10s (, or <)
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() - 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.max(time / duration, 0));
            }
            break;
        }
      }

      /* 
       * Page Navigation Outside Focus Mode
       */
      if (!isTyping && !isFocusMode) {
        const container = getActiveModal() ?? document.scrollingElement ?? document.documentElement;

        switch (e.key) {
          case "j":
            // Scroll down (j)
            e.preventDefault();
            container.scrollBy({ top: 120, behavior: "smooth" });
            break;
          case "k":
            // Scroll up (k)
            e.preventDefault();
            container.scrollBy({ top: -120, behavior: "smooth" });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, router, isFocusMode, focusables, focusedIndex]);

  return (
    <>
      {children}
    </>
  );
}
