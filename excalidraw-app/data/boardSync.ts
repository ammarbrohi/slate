// Server-backed replacement for data/firebase.ts, used by collab when editing a
// board. Same exported signatures so Collab.tsx only swaps its import path.
// Scene + files stay client-side E2E encrypted; the server only stores opaque
// ciphertext (Postgres) and encrypted file blobs (R2).
import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { setSaveState } from "./saveStatus";
import { apiFetch, getCurrentUserName } from "./serverSession";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

// ---- base64 helpers --------------------------------------------------------

const toBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
};

const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
};

const boardIdFromPrefix = (prefix: string): string =>
  prefix.replace(/\/+$/, "").split("/").pop()!;

// ---- scene version cache (mirrors firebase.ts) -----------------------------

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => SceneVersionCache.cache.get(socket);
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => SceneVersionCache.cache.set(socket, getSceneVersion(elements));
}

export const isSavedToFirebase = (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    return SceneVersionCache.get(portal.socket) === getSceneVersion(elements);
  }
  return true;
};

// ---- scene load / save -----------------------------------------------------

const encryptElements = async (
  key: string,
  elements: readonly SyncableExcalidrawElement[],
) => {
  const encoded = new TextEncoder().encode(JSON.stringify(elements));
  const { encryptedBuffer, iv } = await encryptData(key, encoded);
  return { ciphertext: new Uint8Array(encryptedBuffer), iv };
};

export const saveToFirebase = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  _appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (!roomId || !roomKey || !socket || isSavedToFirebase(portal, elements)) {
    return null;
  }
  const { ciphertext, iv } = await encryptElements(roomKey, elements);
  setSaveState({ state: "saving" });
  const res = await apiFetch(`/api/boards/${roomId}/scene`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sceneVersion: getSceneVersion(elements),
      iv: toBase64(iv),
      cipher: toBase64(ciphertext),
    }),
  });
  if (!res.ok) {
    return null;
  }
  SceneVersionCache.set(socket, elements);
  setSaveState({
    state: "saved",
    at: Date.now(),
    by: getCurrentUserName() || "you",
  });
  return toBrandedType<RemoteExcalidrawElement[]>(elements as any);
};

export const loadFromFirebase = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const res = await apiFetch(`/api/boards/${roomId}/scene`);
  if (!res.ok) {
    return null;
  }
  const data = (await res.json()) as {
    iv: string | null;
    cipher: string | null;
  };
  if (!data.cipher || !data.iv) {
    return null;
  }
  const decrypted = await decryptData(
    fromBase64(data.iv),
    fromBase64(data.cipher),
    roomKey,
  );
  const json = new TextDecoder("utf-8").decode(new Uint8Array(decrypted));
  const elements = getSyncableElements(
    restoreElements(JSON.parse(json), null, { deleteInvisibleElements: true }),
  );
  if (socket) {
    SceneVersionCache.set(socket, elements);
  }
  return elements;
};

// ---- files (R2 via server) -------------------------------------------------

export const saveFilesToFirebase = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const boardId = boardIdFromPrefix(prefix);
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const res = await apiFetch(`/api/boards/${boardId}/files/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: buffer as BufferSource as BodyInit,
        });
        (res.ok ? savedFiles : erroredFiles).push(id);
      } catch {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const loadFilesFromFirebase = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const boardId = boardIdFromPrefix(prefix);
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const res = await apiFetch(`/api/boards/${boardId}/files/${id}`);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            { decryptionKey },
          );
          const dataURL = new TextDecoder().decode(data) as DataURL;
          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
