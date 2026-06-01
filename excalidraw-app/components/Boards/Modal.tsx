// Reusable dark modal shell + a single-input prompt modal that replaces the
// native window.prompt() flows (create board, create team, rename).
import { useEffect, useRef, useState } from "react";

import type { ReactNode } from "react";

const CloseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const Modal = ({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="boards-modal-overlay" onMouseDown={onClose}>
      <div
        className="boards-modal"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="boards-modal-head">
          <h2 className="boards-modal-title">{title}</h2>
          <button
            className="boards-icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Destructive confirm: user must type the exact name to enable the button.
export const ConfirmDeleteModal = ({
  itemName,
  itemLabel = "board",
  onConfirm,
  onClose,
}: {
  itemName: string;
  itemLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = value.trim() === itemName;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    if (!matches || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete ${itemLabel}`} onClose={onClose}>
      <p className="boards-modal-board">
        This permanently deletes <strong>{itemName}</strong> and everything in
        it. This cannot be undone.
      </p>
      <label className="boards-field-label">
        Type <strong>{itemName}</strong> to confirm
      </label>
      <input
        ref={inputRef}
        className="boards-input"
        value={value}
        placeholder={itemName}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            submit();
          }
        }}
      />
      {error && <div className="boards-error">{error}</div>}
      <div className="boards-modal-actions">
        <button className="boards-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="boards-btn boards-btn-danger"
          onClick={submit}
          disabled={busy || !matches}
        >
          {busy ? "…" : `Delete ${itemLabel}`}
        </button>
      </div>
    </Modal>
  );
};

export const PromptModal = ({
  title,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Create",
  onConfirm,
  onClose,
}: {
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => Promise<void> | void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <label className="boards-field-label">{label}</label>
      <input
        ref={inputRef}
        className="boards-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            submit();
          }
        }}
      />
      {error && <div className="boards-error">{error}</div>}
      <div className="boards-modal-actions">
        <button className="boards-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="boards-btn boards-btn-primary"
          onClick={submit}
          disabled={busy || !value.trim()}
        >
          {busy ? "…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
};
