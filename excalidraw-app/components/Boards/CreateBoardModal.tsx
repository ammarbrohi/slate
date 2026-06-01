// Create-board modal: name + optional background (default gradient or a photo).
import { useEffect, useRef, useState } from "react";

import { Modal } from "./Modal";
import { PRESETS, presetUrl, unsplash } from "./BackgroundPicker";

export const CreateBoardModal = ({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, background: string | null) => Promise<void> | void;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed, bg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Create board" onClose={onClose} width={480}>
      <label className="boards-field-label">Board name</label>
      <input
        ref={inputRef}
        className="boards-input"
        placeholder="Untitled board"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            submit();
          }
        }}
      />

      <label className="boards-field-label" style={{ marginTop: 16 }}>
        Background
      </label>
      <div className="boards-bg-grid">
        <button
          type="button"
          className={`boards-bg-cell boards-bg-gradient${bg ? "" : " is-active"}`}
          onClick={() => setBg(null)}
        >
          <span className="boards-bg-default-label">Default</span>
        </button>
        {PRESETS.map((id) => {
          const full = presetUrl(id);
          return (
            <button
              key={id}
              type="button"
              className={`boards-bg-cell${bg === full ? " is-active" : ""}`}
              style={{ backgroundImage: `url(${unsplash(id, 200)})` }}
              onClick={() => setBg(full)}
            />
          );
        })}
      </div>

      {error && <div className="boards-error">{error}</div>}

      <div className="boards-modal-actions">
        <button className="boards-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          className="boards-btn boards-btn-primary"
          onClick={submit}
          disabled={busy || !name.trim()}
        >
          {busy ? "…" : "Create"}
        </button>
      </div>
    </Modal>
  );
};
