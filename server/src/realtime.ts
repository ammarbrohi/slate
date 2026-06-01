import { Server as SocketServer } from "socket.io";

import type { Server as HttpServer } from "node:http";

import { verifyClerkToken, verifyLinkToken } from "./auth";
import { accessFor, getBoard } from "./boards";
import { env } from "./env";

// Implements the Excalidraw `excalidraw-room` socket protocol so the existing
// collab client works unchanged. Auth: a socket declares the board (room) it
// wants via handshake; we verify the bearer is either a link token for that
// board or an app user with access. The socket may then only join that room.
export const attachRealtime = (httpServer: HttpServer) => {
  const io = new SocketServer(httpServer, {
    transports: ["websocket", "polling"],
    cors: { origin: env.corsOrigin, methods: ["GET", "POST"] },
    maxHttpBufferSize: 10e6,
  });

  io.use(async (socket, next) => {
    const { token, boardId, devUserId } = socket.handshake.auth ?? {};
    if (!boardId || typeof boardId !== "string") {
      return next(new Error("no_board"));
    }

    // link guest?
    const link = token ? await verifyLinkToken(token) : null;
    if (link && link.boardId === boardId) {
      socket.data.boardId = boardId;
      return next();
    }

    // app user (Clerk or dev bypass)?
    let uid: string | null = null;
    if (env.clerk.devBypass && typeof devUserId === "string" && devUserId) {
      uid = devUserId;
    } else if (token) {
      uid = await verifyClerkToken(token);
    }
    if (uid) {
      const board = await getBoard(boardId);
      if (board && (await accessFor(board, uid))) {
        socket.data.boardId = boardId;
        return next();
      }
    }
    return next(new Error("unauthorized"));
  });

  io.on("connection", (socket) => {
    io.to(socket.id).emit("init-room");

    socket.on("join-room", async (roomId: string) => {
      if (roomId !== socket.data.boardId) {
        return;
      }
      await socket.join(roomId);

      const sockets = await io.in(roomId).fetchSockets();
      if (sockets.length <= 1) {
        io.to(socket.id).emit("first-in-room");
      } else {
        socket.broadcast.to(roomId).emit("new-user", socket.id);
      }
      io.in(roomId).emit(
        "room-user-change",
        sockets.map((s) => s.id),
      );
    });

    socket.on(
      "server-broadcast",
      (roomId: string, data: ArrayBuffer, iv: Uint8Array) => {
        if (socket.rooms.has(roomId)) {
          socket.broadcast.to(roomId).emit("client-broadcast", data, iv);
        }
      },
    );

    socket.on(
      "server-volatile-broadcast",
      (roomId: string, data: ArrayBuffer, iv: Uint8Array) => {
        if (socket.rooms.has(roomId)) {
          socket.volatile.broadcast
            .to(roomId)
            .emit("client-broadcast", data, iv);
        }
      },
    );

    socket.on("user-follow", async (payload: any) => {
      const followRoom = `follow@${payload?.userToFollow?.socketId}`;
      if (payload?.action === "FOLLOW") {
        await socket.join(followRoom);
      } else {
        await socket.leave(followRoom);
      }
      const sockets = await io.in(followRoom).fetchSockets();
      io.to(payload?.userToFollow?.socketId).emit(
        "user-follow-room-change",
        sockets.map((s) => s.id),
      );
    });

    socket.on("disconnecting", async () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) {
          continue;
        }
        const remaining = (await io.in(roomId).fetchSockets()).filter(
          (s) => s.id !== socket.id,
        );
        io.in(roomId).emit(
          "room-user-change",
          remaining.map((s) => s.id),
        );
      }
    });
  });

  return io;
};
