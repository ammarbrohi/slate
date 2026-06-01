// Trello-style board background picker: a default auto-gradient + a grid of
// curated Unsplash photos, plus a hidden "paste your own URL" escape hatch.
import { useState } from "react";

import { setBoardBackground } from "../../data/boardsApi";

import { Modal } from "./Modal";

// Curated Unsplash photo ids. Built into sized URLs below.
export const PRESETS = [
  "1506744038136-46273834b3fb",
  "1469474968028-56623f02e42e",
  "1470071459604-3b5ec3a7fe05",
  "1441974231531-c6227db76b6e",
  "1426604966848-d7adac402bff",
  "1500382017468-9049fed747ef",
  "1472214103451-9374bd1c798e",
  "1462331940025-496dfbfc7564",
  "1419242902214-272b3f66ee7a",
  "1507525428034-b723cf961d3e",
  "1518173946687-a4c8892bbd9f",
  "1447752875215-b2761acb3c5d",
];

export const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}`;

// full-size URL stored on the board; matches what the card renders
export const presetUrl = (id: string) => unsplash(id, 800);

export const BackgroundPicker = ({
  boardId,
  current,
  onClose,
  onChanged,
}: {
  boardId: string;
  current: string | null;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = async (background: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await setBoardBackground(boardId, background);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const applyUrl = () => {
    const v = url.trim();
    if (!/^https?:\/\//.test(v)) {
      setError("Enter a valid image URL (https://…).");
      return;
    }
    apply(v);
  };

  return (
    <Modal title="Board background" onClose={onClose} width={480}>
      <div className="boards-bg-grid">
        {/* default auto-gradient */}
        <button
          className={`boards-bg-cell boards-bg-gradient${current ? "" : " is-active"}`}
          disabled={busy}
          onClick={() => apply(null)}
          title="Default gradient"
        >
          <span className="boards-bg-default-label">Default</span>
        </button>

        {PRESETS.map((id) => {
          const full = presetUrl(id);
          return (
            <button
              key={id}
              className={`boards-bg-cell${current === full ? " is-active" : ""}`}
              disabled={busy}
              style={{ backgroundImage: `url(${unsplash(id, 200)})` }}
              onClick={() => apply(full)}
            />
          );
        })}
      </div>

      {error && <div className="boards-error">{error}</div>}

      <div className="boards-bg-url">
        {showUrl ? (
          <div className="boards-invite-row">
            <input
              className="boards-input"
              placeholder="https://your-image-url…"
              value={url}
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyUrl();
                }
              }}
            />
            <button
              className="boards-btn boards-btn-primary"
              onClick={applyUrl}
              disabled={busy}
            >
              Set
            </button>
          </div>
        ) : (
          <button
            className="boards-bg-url-toggle"
            onClick={() => setShowUrl(true)}
            title="Use a custom image URL"
          >
            link
          </button>
        )}
      </div>
    </Modal>
  );
};
