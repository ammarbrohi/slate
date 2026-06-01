// Full emoji picker (search + categories) for team icons. Rendered in a portal
// at the document root with fixed positioning so it escapes the modal's
// overflow:auto box (otherwise it gets clipped / spawns nested scrollbars).
import EmojiPickerReact, { Theme, EmojiStyle } from "emoji-picker-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WIDTH = 320;
const HEIGHT = 400;

export const EmojiPicker = ({
  anchorEl,
  onPick,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // position below the anchor, clamped to the viewport
  useLayoutEffect(() => {
    if (!anchorEl) {
      return;
    }
    const r = anchorEl.getBoundingClientRect();
    const left = Math.min(r.left, window.innerWidth - WIDTH - 12);
    const top =
      r.bottom + 6 + HEIGHT > window.innerHeight
        ? Math.max(12, r.top - HEIGHT - 6)
        : r.bottom + 6;
    setPos({ top, left: Math.max(12, left) });
  }, [anchorEl]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node) &&
        !anchorEl?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const id = window.setTimeout(
      () => window.addEventListener("mousedown", onDown),
      0,
    );
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose, anchorEl]);

  if (!pos) {
    return null;
  }

  return createPortal(
    <div
      className="boards-emoji-pop"
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 2000 }}
    >
      <EmojiPickerReact
        theme={Theme.DARK}
        emojiStyle={EmojiStyle.NATIVE}
        lazyLoadEmojis
        width={WIDTH}
        height={HEIGHT}
        previewConfig={{ showPreview: false }}
        onEmojiClick={(data) => {
          onPick(data.emoji);
          onClose();
        }}
      />
    </div>,
    document.body,
  );
};
