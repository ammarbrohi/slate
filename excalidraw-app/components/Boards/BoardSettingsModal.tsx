// Board settings hub — one place for rename, background, sharing and delete.
// Opened from the single gear icon on a board card (mirrors Team settings).
import { useState } from "react";

import { renameBoard, deleteBoard } from "../../data/boardsApi";

import { Modal, ConfirmDeleteModal } from "./Modal";
import { BackgroundPicker } from "./BackgroundPicker";
import { ShareModal } from "./ShareModal";

import type { Board } from "../../data/boardsApi";

const hueFromId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return h;
};

const ImageGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const ShareGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

type Sub = null | "bg" | "share" | "delete";

export const BoardSettingsModal = ({
  board,
  onClose,
  onChanged,
}: {
  board: Board;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [name, setName] = useState(board.name);
  const [sub, setSub] = useState<Sub>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim().length > 0 && name.trim() !== board.name;

  const thumbStyle = board.background
    ? { backgroundImage: `url(${board.background})`, backgroundSize: "cover", backgroundPosition: "center" }
    : (() => {
        const h = hueFromId(board.id);
        return {
          background: `linear-gradient(135deg, hsl(${h}, 55%, 42%), hsl(${(h + 45) % 360}, 50%, 30%))`,
        };
      })();

  const saveName = async () => {
    if (!dirty) {
      return;
    }
    setError(null);
    try {
      await renameBoard(board.id, name.trim());
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <Modal title="Board settings" onClose={onClose} width={460}>
        {/* rename + background tile (first option) */}
        <div className="boards-team-settings">
          <button
            type="button"
            className="boards-emoji-btn boards-bg-tile"
            style={thumbStyle}
            onClick={() => setSub("bg")}
            title="Change background"
          />
          <input
            className="boards-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) {
                saveName();
              }
            }}
          />
          {dirty && (
            <button className="boards-btn boards-btn-primary" onClick={saveName}>
              Save
            </button>
          )}
        </div>

        {error && <div className="boards-error">{error}</div>}

        {/* options */}
        <div className="boards-settings-list">
          <button className="boards-settings-row" onClick={() => setSub("bg")}>
            <span className="boards-settings-icon"><ImageGlyph /></span>
            <span className="boards-settings-label">Change background</span>
            <Chevron />
          </button>
          <button className="boards-settings-row" onClick={() => setSub("share")}>
            <span className="boards-settings-icon"><ShareGlyph /></span>
            <span className="boards-settings-label">Share &amp; access</span>
            {board.share_slug && <span className="boards-card-badge">Public</span>}
            <Chevron />
          </button>
        </div>

        <div className="boards-modal-footer">
          <button
            className="boards-btn boards-btn-danger"
            onClick={() => setSub("delete")}
          >
            Delete board
          </button>
        </div>
      </Modal>

      {sub === "bg" && (
        <BackgroundPicker
          boardId={board.id}
          current={board.background}
          onClose={() => setSub(null)}
          onChanged={onChanged}
        />
      )}
      {sub === "share" && (
        <ShareModal
          boardId={board.id}
          onClose={() => {
            setSub(null);
            onChanged();
          }}
        />
      )}
      {sub === "delete" && (
        <ConfirmDeleteModal
          itemName={board.name}
          itemLabel="board"
          onConfirm={async () => {
            await deleteBoard(board.id);
            onChanged();
          }}
          onClose={() => {
            setSub(null);
            onClose();
          }}
        />
      )}
    </>
  );
};
