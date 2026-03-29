'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import '@/styles/confirm-dialog.css';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(opts);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((result: boolean) => {
    setOpen(false);
    setOptions(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, finish]);

  const dialog =
    open &&
    options &&
    mounted &&
    createPortal(
      <div
        className="confirm-dialog-overlay"
        role="presentation"
        onClick={() => finish(false)}
      >
        <div
          className="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-desc"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="confirm-dialog-title" className="confirm-dialog-title">
            {options.title}
          </h2>
          <p id="confirm-dialog-desc" className="confirm-dialog-message">
            {options.message}
          </p>
          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="confirm-dialog-btn confirm-dialog-btn--secondary"
              onClick={() => finish(false)}
            >
              {options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`confirm-dialog-btn ${
                options.variant === 'danger'
                  ? 'confirm-dialog-btn--danger'
                  : 'confirm-dialog-btn--primary'
              }`}
              onClick={() => finish(true)}
            >
              {options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx.confirm;
}
