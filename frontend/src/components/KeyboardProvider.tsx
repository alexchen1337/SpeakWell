"use client";

/*
 * Issues:
 *  1. Pressing escape in focus mode with modal open closes modal
 *  2. isElementVisible does not account for modal header
 *  3. No way to change volume on player screen
 *  4. No way to filter results on library screen
 *  5. z-index of focus-highlight must be below header and compact hint bar
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
    EXIT_FOCUS  : { key: ["f", "Escape"], desc: "Exit Focus Mode" },
    NEXT        : { key: "j",             desc: "Next Element" },
    PREV        : { key: "k",             desc: "Previous Element" },
    TOP         : { key: "t",             desc: "Go to Top Visible Element" },
    MIDDLE      : { key: "m",             desc: "Go to Middle Visble Element" },
    BOTTOM      : { key: "b",             desc: "Go to Bottom Visible Element" },
    SELECT      : { key: "Enter",         desc: "Select Element" },
  },

  AUDIO_PLAYER: {
    PLAY_PAUSE  : { key: " ",             desc: "Play / Pause" },
    FORWARD     : { key: [".", ">"],      desc: "Fast Forward" },
    REWIND      : { key: [",", "<"],      desc: "Rewind" },
    VIEW_GRADE  : { key: "v",             desc: "View Grading"},
    GRADE_PRES  : { key: "g",             desc: "Grade Presentation"},
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
   * Get every HTML element that should be focusable in Focus Mode
   */
  const getFocusableElements = () => {
    const modal = getActiveModal();
    const root: ParentNode = modal ?? document;

    let all = Array.from(
      root.querySelectorAll<HTMLElement>(`
        button, 
        a, 
        [role='button'], 
        input:not([type='hidden']), 
        textarea, 
        .grading-card.completed, 
        .library-upload-dropzone,
        .transcript-word-new,
        .rubric-card,
        .result-header,
        .grading-dash-card,
        .class-card,
        .class-dash-card,
        .presentation-row
      `)
    ).filter(el => !el.hasAttribute("disabled"));

    // Ignore elemnts in page header
    const header = document.querySelector("header");
    if (header) {
      all = all.filter(el => !header.contains(el));
    }

    // Ignore elements in player header
    const playerHeader = document.querySelector(".player-header-bar");
    if (playerHeader) {
      all = all.filter(el => !playerHeader.contains(el));
    }

    // Ignore elements in modal header
    const modalHeader = document.querySelector(".modal-header");
    if (modalHeader) {
      all = all.filter(el => !modalHeader.contains(el));
    }

    return all;
  };

  /* 
  * Highlight focused element 
  */
  useEffect(() => {
    if (!isFocusMode || focusables.length === 0) return;

    focusables.forEach(el => el.classList.remove("focus-highlight"));
    const active = focusables[focusedIndex];
    active?.classList.add("focus-highlight");

    const scrollContainer = 
      getActiveModalScrollContainer() 
      ?? getTranscriptScrollContainer() 
      ?? window;

    const visible = getVisibleIndicies(focusables);

    // Scroll element into view only when no elements are visible
    if (visible.length === 0 && active) scrollIntoViewIfNeeded(active, scrollContainer);
  }, [isFocusMode, focusedIndex, focusables]);

  /*
   * Check if HTML element is visible .
   * At least 2/3 of element height must appear between header and hint bar.
   */
  const isElementVisible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const { topOffset, bottomOffset } = getViewportOffsets();
    const maxHiddenHeight = 0.33 * rect.height;

    return (
      rect.top + maxHiddenHeight > topOffset &&
      rect.bottom - maxHiddenHeight < window.innerHeight - bottomOffset &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  };

  /*
   * Get indicies of HTML elements that are focusable and visible
   */
  const getVisibleIndicies = (elements: HTMLElement[]) => {
    return elements
      .map((el, index) => ({ el, index}))
      .filter(({ el }) => isElementVisible(el))
      .map(({ index }) => index);
  };

  /*
   * Scroll page if focused element is offscreen
   */
  const scrollIntoViewIfNeeded = (el: HTMLElement, container: HTMLElement | Window = window) => {
    const rect = el.getBoundingClientRect();

    const isWindow = container instanceof Window;

    const containerRect = isWindow
      ? { top: 0, bottom: window.innerHeight }
      : container.getBoundingClientRect();

    const scrollTop = isWindow ? window.scrollY : container.scrollTop;

    const viewportTop = isWindow
      ? getViewportOffsets().topOffset
      : containerRect.top + (
          container.querySelector<HTMLElement>(".modal-header")?.offsetHeight ?? 0
        );

    const viewportBottom = isWindow
      ? window.innerHeight - getViewportOffsets().bottomOffset
      : containerRect.bottom;

    const offsetTop = rect.top - containerRect.top + scrollTop;

    // Above viewport
    if (rect.top < viewportTop) {
      const scrollTo = offsetTop - (viewportTop - containerRect.top);
      isWindow
        ? window.scrollBy({ top: scrollTo - scrollTop, behavior: "smooth" })
        : container.scrollTo({ top: scrollTo, behavior: "smooth" });
    }

    // Below viewport
    else if (rect.bottom > viewportBottom) {
      const scrollTo = offsetTop - (viewportBottom - containerRect.top) + rect.height;
      isWindow
        ? window.scrollBy({ top: scrollTo - scrollTop, behavior: "smooth" })
        : container.scrollTo({ top: scrollTo, behavior: "smooth" });
    }
  };

  /*
   * Get header and hint bar offsets.
   *
   * For knowing when a focusable element is hidden 
   * behind the page header or hint bar.
   */
  const getViewportOffsets = () => {
    const header = document.querySelector<HTMLElement>(".site-header");
    const hintBar = document.querySelector<HTMLElement>(".keyboard-hint-bar");

    const topOffset = header?.offsetHeight ?? 0;
    const bottomOffset = hintBar?.offsetHeight ?? 0;

    return { topOffset, bottomOffset };
  }

  /*
   * Update visible elements when screen moves
   */
  useEffect(() => {
    if (!isFocusMode) return;

    const handleScroll = () => {
      const visible = getVisibleIndicies(focusables);

      // Move to first visible focusable element
      // if last focused index is offscreen
      if (!isElementVisible(focusables[focusedIndex])) {
        if (visible.length > 0) {
          setFocusedIndex(visible[0]);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFocusMode, focusables, focusedIndex]);

  /*
   * Reset focused index when route changes
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
    return document.querySelector<HTMLElement>(
      ".modal-overlay, .grading-modal-overlay, .rubric-selector-modal"
    );
  };

  /*
   * Get scroll container of modal
   */
  const getActiveModalScrollContainer = (): HTMLElement | null => {
    // Try grading modal scroll container
    const gradingBody = document.querySelector<HTMLElement>(".grading-modal-body");
    if (gradingBody) return gradingBody;

    // Try rubric modal scroll container
    const rubricForm = document.querySelector<HTMLElement>(".rubric-form");
    if (rubricForm) return rubricForm;

    // Try rubric selector scroll container
    const rubricSelector = document.querySelector<HTMLElement>(".rubric-selector-content");
    if (rubricSelector) return rubricSelector;

    return null;
  };

  /*
   * Get scroll container for transcription page
   */
  const getTranscriptScrollContainer = (): HTMLElement | null => {
    return document.querySelector<HTMLElement>(".transcript-content-new");
  }

  /*
   * Get player screen buttons
   */
  const getPlayerActionButton = (label: string): HTMLButtonElement | null => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    );

    return buttons.find(
      btn => btn.textContent?.trim() === label
    ) ?? null;
  };

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

      /*
       * Escape Key
       */
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
          modal?.dispatchEvent(
            new MouseEvent("click", { bubbles: true })
          );

          // Reset modal focus index
          setLastFocusedByScope(prev => {
           const next = { ...prev};
           delete next['modal'];
           return next;
          });

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

          case KEYMAP.FOCUS_MODE.NEXT.key: {
            // Jump to next visible focusable element
            const visible = getVisibleIndicies(focusables);

            setFocusedIndex(current => {
              const curVisibleIndex = visible.indexOf(current);

              const nextVisibleIndex =
                curVisibleIndex === -1
                ? 0
                : (curVisibleIndex + 1) % visible.length;

              return visible[nextVisibleIndex];
            });
            break;
          }

          case KEYMAP.FOCUS_MODE.PREV.key: {
            // Jump to previous visible focusable element
            const visible = getVisibleIndicies(focusables);

            setFocusedIndex(current => {
              const curVisibleIndex = visible.indexOf(current);

              const prevVisibleIndex =
                curVisibleIndex === -1
                ? visible.length - 1
                : (curVisibleIndex - 1 + visible.length) % visible.length;

              return visible[prevVisibleIndex];
            });
            break;
          }

          case KEYMAP.FOCUS_MODE.TOP.key: {
            // Jump to first visible focusable element
            const visible = getVisibleIndicies(focusables);
            if (visible.length > 0) {
              setFocusedIndex(visible[0]);
            }
            break;
          }

          case KEYMAP.FOCUS_MODE.MIDDLE.key: {
            // Jump to middle visible focusable element
            const visible = getVisibleIndicies(focusables);
            if (visible.length > 0) {
              const mid = Math.floor(visible.length / 2);
              setFocusedIndex(visible[mid]);
            }
            break;
          }

          case KEYMAP.FOCUS_MODE.BOTTOM.key: {
            // Jump to bottom visible focusable element
            const visible = getVisibleIndicies(focusables);
            if (visible.length > 0) {
              setFocusedIndex(visible[visible.length - 1]);
            }
            break;
          }

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

      /*
       *  Entering Focus Mode
       */
      if (e.key === KEYMAP.NORMAL_MODE.ENTER_FOCUS.key 
          && !isTyping && !isFocusMode) {
        e.preventDefault();

        const els = getFocusableElements();
        if (els.length === 0) return;

        setFocusables(els);

        const modal = getActiveModal();
        const scopeKey = modal ? 'modal' : pathname;

        const savedIndex = lastFocusedByScope[scopeKey];

        if (savedIndex !== undefined && savedIndex < els.length) {
          // Entered Focus Mode at least once already on current page
          if (isElementVisible(els[savedIndex])) {
            // Jump to saved index if it is visible
            setFocusedIndex(savedIndex);
          } else {
            // Otherwsie, fallback to first visible element
            const visible = getVisibleIndicies(els);
            setFocusedIndex(visible.length > 0 ? visible[0] : 0);
          }
        } else {
          // First time entering Focus Mode on current page
          const visible = getVisibleIndicies(els);
          setFocusedIndex(visible.length > 0 ? visible[0] : 0);
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

          case KEYMAP.AUDIO_PLAYER.VIEW_GRADE.key: {
            const btn = getPlayerActionButton("View Grading");
            btn?.click();
            break;
          }

          case KEYMAP.AUDIO_PLAYER.GRADE_PRES.key: {
            const btn = getPlayerActionButton("Grade Presentation");
            btn?.click();
            break;
          }
        }
      }

      /* =========================================================
         Page Navigation
      ========================================================= */
      if (!isTyping && !isFocusMode) {
          const scrollContainer = getActiveModalScrollContainer() 
            ?? getTranscriptScrollContainer() 
            ?? document.scrollingElement ?? document.body;

        switch (e.key) {
          case KEYMAP.NORMAL_MODE.SCROLL_DOWN.key:
            e.preventDefault();
            scrollContainer.scrollBy({ top: 120, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_UP.key:
            e.preventDefault();
            scrollContainer.scrollBy({ top: -120, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_TOP.key:
            e.preventDefault();
            scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_MID.key:
            e.preventDefault();
            scrollContainer.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" });
            break;

          case KEYMAP.NORMAL_MODE.SCROLL_BOT.key:
            e.preventDefault();
            scrollContainer.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
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
          <span className="hint-text">to toggle the full list of keyboard shortcuts</span>
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
