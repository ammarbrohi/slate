// Tiny pub/sub for the "saved" indicator. boardSync pushes a status after every
// successful server save; the editor's indicator subscribes to render it.
export type SaveState =
  | { state: "saving" }
  | { state: "saved"; at: number; by: string }
  | { state: "idle" };

let current: SaveState = { state: "idle" };
const listeners = new Set<(s: SaveState) => void>();

export const setSaveState = (s: SaveState) => {
  current = s;
  listeners.forEach((l) => l(s));
};

export const getSaveState = () => current;

export const subscribeSaveState = (fn: (s: SaveState) => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
