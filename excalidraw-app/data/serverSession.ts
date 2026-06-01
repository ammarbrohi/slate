// Holds the auth + active-board context for talking to the sync server.
// React (the auth layer) pushes credentials in here so non-React modules
// (Collab, boardSync) can read them without prop-drilling.

export const SYNC_SERVER: string =
  import.meta.env.VITE_APP_SYNC_SERVER || "http://localhost:3002";

type AuthProvider = {
  // headers identifying the caller to REST endpoints
  getAuthHeaders: () => Promise<Record<string, string>>;
  // payload passed in the socket.io handshake `auth`
  getSocketAuth: () => Promise<Record<string, unknown>>;
};

let authProvider: AuthProvider = {
  getAuthHeaders: async () => ({}),
  getSocketAuth: async () => ({}),
};

export const setAuthProvider = (p: AuthProvider) => {
  authProvider = p;
};

// The board currently open in the editor (id === realtime room id).
type BoardSession = { boardId: string; roomKey: string } | null;
let boardSession: BoardSession = null;

export const setBoardSession = (s: BoardSession) => {
  boardSession = s;
};
export const getBoardSession = () => boardSession;

// Display name of the signed-in user, used as the live-collaboration username.
let currentUserName: string | null = null;
export const setCurrentUserName = (name: string | null) => {
  currentUserName = name;
};
export const getCurrentUserName = () => currentUserName;

export const getAuthHeaders = () => authProvider.getAuthHeaders();
export const getSocketAuth = async () => ({
  ...(await authProvider.getSocketAuth()),
  boardId: boardSession?.boardId,
});

// Convenience fetch that injects auth headers + base URL.
export const apiFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = {
    ...(init.headers as Record<string, string>),
    ...(await getAuthHeaders()),
  };
  return fetch(`${SYNC_SERVER}${path}`, { ...init, headers });
};
