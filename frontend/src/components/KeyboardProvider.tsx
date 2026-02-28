"use client";

/*
 * Issues:
 *  1. Focus mode does not recognize audio upload button
 *  2. No way to change volume on player screen
 *  3. j and k do not scroll in modal
 *  4. Make it more obvious that you are in focus mode (maybe message in bottom
 *     right of screen)
 */

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type WaveSurfer from "wavesurfer.js";
import './KeyboardProvider.css'

/* =========================================================
    KEYBOARD MAPPINGS
   ---------------------------------------------------------
    NORMAL MODE
        f           :   Enter Focus Mode
        j           :   Scroll Down
        k           :   Scroll Up
        Escape      :   Exit text box
        Shift+s     :   Navigate to Search
        Shift+l     :   Navigate to Library
        Shift+c     :   Navigate to Classes
        Shift+a     :   Navigate to Analytics
        Shift+d     :   Navigate to Dashboard
        Shift+p     :   Navigate to Profile
        Shift+q     :   Sign Out

        PLAYER SCREEN
            Space       :   Pause/Play
            . or >      :   Forward 10s
            , or <      :   Backward 10s

    FOCUS MODE
        j           :   Next Focusable Element
        k           :   Previous Focusable Element
        t           :   Jump to Top of Focusable Elements
        m           :   Jump to Middle of Focusable Elements
        b           :   Jump to Bottom of Focusable Elements
        Enter       :   Activate Focused Element
        Escape or f :   Exit Focus Mode

   ========================================================= */

export const KEYMAP = {
  NORMAL: {
    ENTER_FOCUS: "f",
    SCROLL_DOWN: "j",
    SCROLL_UP: "k",
  },

  FOCUS: {
    NEXT: "j",
    PREV: "k",
    TOP: "t",
    MIDDLE: "m",
    BOTTOM: "b",
    SELECT_ELEMENT: "Enter",
    EXIT_FOCUS: ["Escape", "f"],
  },

  PLAYER: {
    PLAY_PAUSE: " ",
    FORWARD: [".", ">"],
    REWIND: [",", "<"],
  },

  GLOBAL: {
    SIGN_OUT: "Q",
    ESCAPE: "Escape",
    ROUTES: {
      D: "/dashboard",
      L: "/library",
      C: "/classes",
      S: "/search",
      A: "/analytics",
      P: "/profile",
    },
  },
} as const;

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

    // Skip any elements inside the header
    const header = document.querySelector("header");
    if (!header) return all;

    return all.filter(el => !header.contains(el));
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
      if (e.key === KEYMAP.GLOBAL.ESCAPE && !isFocusMode) {
        if (isTyping) {
          e.preventDefault();

          // Exit text box
          target.blur();
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

      /* =========================================================
         Shift+Key Global Shortcuts
      ========================================================= */
      if (e.shiftKey && !isTyping) {
        // Jump to route in GLOBAL.ROUTES
        const route = KEYMAP.GLOBAL.ROUTES[e.key.toUpperCase() as keyof typeof KEYMAP.GLOBAL.ROUTES];
        if (route) {
          e.preventDefault();
          if (pathname !== route) router.push(route);
          return;
        }

        // Sign out
        if (e.key.toUpperCase() === KEYMAP.GLOBAL.SIGN_OUT) {
          e.preventDefault();
          const signOutButton = Array.from(
            document.querySelectorAll<HTMLButtonElement>(".auth-button")
          ).find(btn => btn.textContent?.trim().includes("Sign out"));
          signOutButton?.click();
          setIsFocusMode(false);
          return;
        }
      }

      /* =========================================================
         Focus mode shortcuts
      ========================================================= */
      if (isFocusMode) {
        e.preventDefault();
        const active = focusables[focusedIndex];
        if (!active) return;
        const modal = getActiveModal();
        const scopeKey = modal ? 'modal' : pathname;

        switch (e.key) {

          case KEYMAP.FOCUS.EXIT_FOCUS[0]:
          case KEYMAP.FOCUS.EXIT_FOCUS[1]:
            // Save the last focused element
            setLastFocusedByScope(prev => ({
                ...prev,
                [scopeKey]: focusedIndex
            }));

            // Exit Focus Mode
            focusables.forEach(el => el.classList.remove("focus-highlight"));
            setIsFocusMode(false);

          case KEYMAP.FOCUS.NEXT:            
            // Jump to next focusable element
            setFocusedIndex(i => (i + 1) % focusables.length);
            break;

          case KEYMAP.FOCUS.PREV:            
            // Jump to previous focusable element
            setFocusedIndex(i => (i - 1 + focusables.length) % focusables.length);
            break;

          case KEYMAP.FOCUS.TOP:
            // Jump to first focusable element
            setFocusedIndex(0);
            break;

          case KEYMAP.FOCUS.MIDDLE:
            // Jump to middle focusable element
            setFocusedIndex(focusables.length/2);
            break;

          case KEYMAP.FOCUS.BOTTOM:
            // Jump to last focusable element
            setFocusedIndex(focusables.length-1)
            break;

          case KEYMAP.FOCUS.SELECT_ELEMENT:
            // Save the last focused element
            setLastFocusedByScope(prev => ({
                ...prev,
                [scopeKey]: focusedIndex
            }));

            if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") {
              // Enter text
              (active as HTMLInputElement | HTMLTextAreaElement).focus();
            } else {
              // Select focused element
              active.click();
            }

            // Exit Focus Mode
            focusables.forEach(el => el.classList.remove("focus-highlight"));
            setIsFocusMode(false);
            break;
        }

        return;
      }

      // Enter Focus Mode
      if (e.key === KEYMAP.NORMAL.ENTER_FOCUS && !isTyping && !isFocusMode) {
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
            : 0
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

      /* =========================================================
       * Player Screen Shortcuts
      ========================================================= */
      if (!isTyping && !isFocusMode && pathname.startsWith("/player")) {
        const ws: WaveSurfer | null = (window as any).wavesurferInstance;
        const playButton = document.querySelector<HTMLButtonElement>(".play-btn");

        switch (e.key) {
          case KEYMAP.PLAYER.PLAY_PAUSE:
            // Pause/play
            e.preventDefault();
            if (ws) ws.playPause();
            else playButton?.click();
            break;

          case KEYMAP.PLAYER.FORWARD[0]:
          case KEYMAP.PLAYER.FORWARD[1]:
            // Fast forward 10s
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() + 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.min(time / duration, 1));
            }
            break;

          case KEYMAP.PLAYER.REWIND[0]:
          case KEYMAP.PLAYER.REWIND[1]:
            // Rewind 10s
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() - 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.max(time / duration, 0));
            }
            break;
        }
      }

      /* =========================================================
         Page Navigation
      ========================================================= */
      if (!isTyping && !isFocusMode) {
        const container = getActiveModal() ?? document.scrollingElement ?? document.documentElement;
        switch (e.key) {
          case KEYMAP.NORMAL.SCROLL_DOWN:
            e.preventDefault();
            container.scrollBy({ top: 120, behavior: "smooth" });
            break;
          case KEYMAP.NORMAL.SCROLL_UP:
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
