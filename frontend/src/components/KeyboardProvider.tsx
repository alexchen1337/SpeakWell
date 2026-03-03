"use client";

/*
 * Issues:
 *  1. Remember the last focused element only if it’s visible, otherwise jump
 *     to the first visible focusable element.
 *        * t should jump to first visible focusable element
 *        * m should jump to middel visible focusable element
 *        * b should jump to last visible focusable element
 *  2. Focus mode does not recognize audio upload button
 *  3. No way to change volume on player screen
 *  4. j and k do not scroll in modals
 */

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type WaveSurfer from "wavesurfer.js";
import './KeyboardProvider.css'

/* =========================================================
    KEYBOARD MAPPINGS
========================================================= */
export const KEYMAP = {
  GLOBAL_BINDINGS: {
    SHOW_BINDS  : { key: "H",             desc: "Toggle List of Bindings"},
    SIGN_OUT    : { key: "Q",             desc: "Sign Out" },
    ESCAPE      : { key: "Escape",        desc: "Cancel" },
    ROUTES: {
      D         : { key: "D",             desc: "Dashboard",  route: "/dashboard"},
      L         : { key: "L",             desc: "Library",    route: "/library"},
      C         : { key: "C",             desc: "Classes",    route: "/classes" },
      S         : { key: "S",             desc: "Search",     route: "/search" },
      A         : { key: "A",             desc: "Analytics",  route: "/analytics"},
      P         : { key: "P",             desc: "Profile",    route: "/profile"},
    },
  },

  NORMAL_MODE: {
    ENTER_FOCUS : { key: "f",             desc: "Enter Focus Mode" },
    SCROLL_DOWN : { key: "j",             desc: "Scroll Down" },
    SCROLL_UP   : { key: "k",             desc: "Scroll Up" },
    SCROLL_TOP  : { key: "t",             desc: "Scroll to Top of Screen" },
    SCROLL_MID  : { key: "m",             desc: "Scroll to Middle of Screen" },
    SCROLL_BOT  : { key: "b",             desc: "Scroll to Bottom of Screen" },
  },

  FOCUS_MODE: {
    NEXT        : { key: "j",             desc: "Next Element" },
    PREV        : { key: "k",             desc: "Previous Element" },
    SELECT      : { key: "Enter",         desc: "Select Element" },
    TOP         : { key: "t",             desc: "Go to Top Visible Element" },
    MIDDLE      : { key: "m",             desc: "Go to Middle Visble Element" },
    BOTTOM      : { key: "b",             desc: "Go to Bottom Visible Element" },
    EXIT_FOCUS  : { key: ["Escape", "f"], desc: "Exit Focus Mode" },
  },

  AUDIO_PLAYER: {
    PLAY_PAUSE  : { key: " ",             desc: "Play / Pause" },
    FORWARD     : { key: [".", ">"],      desc: "Fast Forward" },
    REWIND      : { key: [",", "<"],      desc: "Rewind" },
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
  const [showKeybindings, setShowKeybindings] = useState(false);

/* =========================================================
    HELPERS
========================================================= */

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
      if (e.key === KEYMAP.GLOBAL_BINDINGS.ESCAPE.key && !isFocusMode) {
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
        // Jump to route in GLOBAL_BINDINGS.ROUTES
        const routeObj = KEYMAP.GLOBAL_BINDINGS.ROUTES[e.key.toUpperCase() as keyof typeof KEYMAP.GLOBAL.ROUTES];
        if (routeObj) {
          e.preventDefault();
          const routePath = routeObj.route;
          if (pathname !== routePath) router.push(routePath);
          return;
        }

        // Sign out
        if (e.key.toUpperCase() === KEYMAP.GLOBAL_BINDINGS.SIGN_OUT.key) {
          e.preventDefault();
          const signOutButton = Array.from(
            document.querySelectorAll<HTMLButtonElement>(".auth-button")
          ).find(btn => btn.textContent?.trim().includes("Sign out"));
          signOutButton?.click();
          setIsFocusMode(false);
          return;
        }

        // Show keybindings
        if (e.key.toUpperCase() === KEYMAP.GLOBAL_BINDINGS.SHOW_BINDS.key) {
            setShowKeybindings(v => !v);
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

          case KEYMAP.FOCUS_MODE.EXIT_FOCUS.key[0]:
          case KEYMAP.FOCUS_MODE.EXIT_FOCUS.key[1]:
            // Save the last focused element
            setLastFocusedByScope(prev => ({
                ...prev,
                [scopeKey]: focusedIndex
            }));

            // Exit Focus Mode
            focusables.forEach(el => el.classList.remove("focus-highlight"));
            setIsFocusMode(false);
            break;

          case KEYMAP.FOCUS_MODE.NEXT.key:            
            // Jump to next focusable element
            setFocusedIndex(i => (i + 1) % focusables.length);
            break;

          case KEYMAP.FOCUS_MODE.PREV.key:            
            // Jump to previous focusable element
            setFocusedIndex(i => (i - 1 + focusables.length) % focusables.length);
            break;

          case KEYMAP.FOCUS_MODE.TOP.key:
            // Jump to first focusable element
            setFocusedIndex(0);
            break;

          case KEYMAP.FOCUS_MODE.MIDDLE.key:
            // Jump to middle focusable element
            setFocusedIndex(focusables.length/2);
            break;

          case KEYMAP.FOCUS_MODE.BOTTOM.key:
            // Jump to last focusable element
            setFocusedIndex(focusables.length-1)
            break;

          case KEYMAP.FOCUS_MODE.SELECT.key:
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
      if (e.key === KEYMAP.NORMAL_MODE.ENTER_FOCUS.key && !isTyping && !isFocusMode) {
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
          case KEYMAP.AUDIO_PLAYER.PLAY_PAUSE.key:
            // Pause/play
            e.preventDefault();
            if (ws) ws.playPause();
            else playButton?.click();
            break;

          case KEYMAP.AUDIO_PLAYER.FORWARD.key[0]:
          case KEYMAP.AUDIO_PLAYER.FORWARD.key[1]:
            // Fast forward 10s
            e.preventDefault();
            if (ws) {
              const time = ws.getCurrentTime() + 10;
              const duration = ws.getDuration();
              ws.seekTo(Math.min(time / duration, 1));
            }
            break;

          case KEYMAP.AUDIO_PLAYER.REWIND.key[0]:
          case KEYMAP.AUDIO_PLAYER.REWIND.key[1]:
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
        switch (e.key) {
          case KEYMAP.NORMAL_MODE.SCROLL_DOWN.key:
            e.preventDefault();
            window.scrollBy({ top: 120, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_UP.key:
            e.preventDefault();
            window.scrollBy({ top: -120, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_TOP.key:
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_MID.key:
            e.preventDefault();
            window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_BOT.key:
            e.preventDefault();
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, router, isFocusMode, focusables, focusedIndex]);

  function ShortcutRow({
    desc,
    keys,
  }: {
    desc: string;
    keys: string[];
  }) {
    return (
      <div className="shortcut-row">
        <div className="shortcut-desc">{desc}</div>

        <div className="shortcut-keys">
          {keys.map((key, i) => (
            <span key={i} className="shortcut-key-group">
              <kbd>{key}</kbd>
              {i < keys.length - 1 && (
                <span className="shortcut-slash">/</span>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* Compact Hint Bar*/}
      <div className="keyboard-hint-bar">
        <span className="hint-toggle">
          <span className="hint-text">Press</span>
          <kbd>{KEYMAP.GLOBAL_BINDINGS.SHOW_BINDS.key}</kbd>
          <span className="hint-text">to view the full list of shortcuts</span>
        </span>

        <span className="hint-separator">•</span>
        <span className="mode-label">
          {isFocusMode ? "Focus Mode" : "Normal Mode"}
        </span>
      </div>

      {/* Shortcuts Panel */}
      {showKeybindings && (
        <div className="shortcuts-overlay">
          <div className="shortcuts-container">
            <h2 className="shortcuts-title">Keyboard Shortcuts</h2>

            <div className="shortcuts-grid">
              {Object.entries(KEYMAP).map(([modeKey, modeObj]) => (
                <div key={modeKey} className="shortcut-section">
                  <div className="section-title">
                    {modeKey.replace(/_/g, " ")}
                  </div>
                  <div className="section-divider" />

                  {modeKey === "GLOBAL_BINDINGS" ? (
                    <>
                      <ShortcutRow
                        desc={modeObj.SIGN_OUT.desc}
                        keys={[modeObj.SIGN_OUT.key]}
                      />
                      {Object.entries(modeObj.ROUTES).map(([k, v]) => (
                        <ShortcutRow
                          key={k}
                          desc={v.desc}
                          keys={[v.key]}
                        />
                      ))}
                    </>
                  ) : (
                    Object.entries(modeObj).map(([k, v]) => {
                      const keyArray = Array.isArray(v.key)
                        ? v.key
                        : [v.key];

                      return (
                        <ShortcutRow
                          key={k}
                          desc={v.desc}
                          keys={keyArray.map(kItem =>
                            kItem === " " ? "Space" : kItem
                          )}
                        />
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
