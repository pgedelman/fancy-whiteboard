# Fancy Whiteboard

A real-time collaborative whiteboard. Multiple users draw on the same canvas at once and see each other's strokes and cursors live, powered by WebSockets.

## Features

- **Live collaborative drawing** — strokes are broadcast to every connected client in the room via Socket.IO.
- **Live cursors** — see other users' cursor positions as they move around the canvas.
- **Tools** — pen, eraser, adjustable brush size, color picker with recent-color history, full-canvas fill.
- **Undo / erase** — undo your own last stroke, or erase the most recent stroke globally.
- **Persistent history** — strokes are stored server-side (MongoDB, or an in-memory fallback) and replayed for anyone who joins a room, or refreshes the page.
- **Resolution-independent** — points are stored normalized (0–1), so drawings render correctly regardless of each viewer's screen size or device pixel ratio.

## Tech stack

| | |
|---|---|
| Client | React 18, Vite |
| Server | Node.js, Express, Socket.IO |
| Storage | MongoDB (optional) via Mongoose, in-memory fallback |

## Project structure

```
client/   React + Vite frontend
server/   Express + Socket.IO backend (Dockerfile included)
```

## Getting started

### Prerequisites

- Node.js 18+
- (Optional) A MongoDB connection string, if you want strokes to persist across server restarts.

### 1. Server

```bash
cd server
npm install
cp .env.example .env   # edit as needed
npm run dev             # nodemon, or `npm start` for plain node
```

The server listens on `PORT` (default `4000`). Without a `MONGO_URI`, it falls back to an in-memory store — strokes persist for the life of the process only.

### 2. Client

```bash
cd client
npm install
cp .env.example .env   # edit as needed
npm run dev
```

Vite will print a local dev URL (default `http://localhost:5173`). By default the client connects to a server at `http://localhost:4000`.

### Environment variables

**`server/.env`**

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the server listens on | `4000` |
| `CLIENT_ORIGIN` | Allowed CORS origin | any origin |
| `MONGO_URI` | MongoDB connection string | unset (in-memory store) |

**`client/.env`**

| Variable | Description | Default |
|---|---|---|
| `VITE_SERVER_URL` | URL of the whiteboard server | `http://localhost:4000` |
| `VITE_ROOM_ID` | Room to join | `main` |

## How it works

Each pointer stroke is collected as a series of normalized `{x, y}` points. While drawing, throttled in-progress snapshots are broadcast to other clients for a live preview, and the completed stroke is sent once more (marked `final`) when the pointer lifts. The server only persists finalized strokes, broadcasting the rest purely for real-time feedback. On joining a room, a client receives the full stroke history and replays it onto its canvas.

## Deployment

A `Dockerfile` is included for the server. The client is a static Vite app — build it with `npm run build` in `client/` and serve the `dist/` output from any static host, pointing `VITE_SERVER_URL` at your deployed server.

## License

MIT — see [LICENSE](LICENSE).
