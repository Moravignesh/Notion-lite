# 📝 Notion Lite — Real-Time Collaborative Notes & Task Board

A full-stack collaborative platform built with **FastAPI**, **React**, **SQLite**, and **WebSockets**. Multiple users can create, edit, and collaborate on notes and task boards in real time.

---

## 🚀 Quick Start (VS Code — Recommended)

### Prerequisites

- Python 3.10+
- Node.js 18+
- VS Code with Python & ESLint extensions

---
### Demo videos

frontend demo video : https://drive.google.com/file/d/1y6Rxe09vwLyErKXRAqzQCG2SuTghU7mD/view?usp=sharing
Backend demo video : https://drive.google.com/file/d/1xdFAhL3423gDEQoVVTCFCl9MQi9qj3d0/view?usp=sharing
### 1. Clone / Open the Project

```bash
git clone <your-repo-url>
cd notion-lite
code .   # Open in VS Code
```

---

### 2. Backend Setup

```bash
# Open a new terminal in VS Code (Ctrl+`)
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# (Optional) edit .env to change SECRET_KEY

# Run the server
uvicorn app.main:app --reload --port 8000
```

The backend starts at: **http://localhost:8000**
API docs (Swagger): **http://localhost:8000/docs**

---

### 3. Frontend Setup

```bash
# Open a second terminal in VS Code
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend starts at: **http://localhost:5173**

> The Vite dev server proxies `/api` and `/ws` to `localhost:8000` automatically.

---

### 4. Docker Setup (Optional)

```bash
# From the project root
docker-compose up --build
```

- Frontend: http://localhost:80
- Backend: http://localhost:8000

---

## 🏗️ Project Structure

```
notion-lite/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (env vars)
│   │   ├── database.py          # SQLAlchemy async engine
│   │   ├── models/
│   │   │   ├── user.py          # User model
│   │   │   ├── workspace.py     # Workspace, Member, Invitation models
│   │   │   ├── note.py          # Note, NoteVersion models
│   │   │   └── task.py          # TaskBoard, Task, Comment models
│   │   ├── schemas/
│   │   │   ├── user.py          # Pydantic schemas
│   │   │   ├── workspace.py
│   │   │   ├── note.py
│   │   │   └── task.py
│   │   ├── routers/
│   │   │   ├── auth.py          # /api/auth/*
│   │   │   ├── workspace.py     # /api/workspaces/*
│   │   │   ├── notes.py         # /api/notes/*
│   │   │   ├── tasks.py         # /api/tasks/*
│   │   │   ├── search.py        # /api/search
│   │   │   └── websocket.py     # /ws/{workspace_id}
│   │   ├── services/
│   │   │   └── websocket_manager.py  # WS connection + presence
│   │   └── utils/
│   │       ├── security.py      # JWT, bcrypt
│   │       └── dependencies.py  # Auth dependencies, RBAC
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx             # Entry point
│   │   ├── App.jsx              # Router
│   │   ├── index.css            # Global styles + CSS variables (dark/light)
│   │   ├── context/
│   │   │   ├── AuthContext.jsx  # Auth state, login/logout
│   │   │   └── WebSocketContext.jsx  # WS connection, presence
│   │   ├── services/
│   │   │   └── api.js           # Axios API calls
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx    # Workspace list
│   │   │   ├── WorkspacePage.jsx # Notes + Task board view
│   │   │   └── NoteEditor.jsx   # Full markdown editor
│   │   └── components/
│   │       ├── Navbar.jsx       # Top nav + global search
│   │       ├── Modal.jsx        # Reusable modal
│   │       ├── PresenceIndicator.jsx  # Online users
│   │       ├── KanbanBoard.jsx  # DnD Kanban
│   │       ├── TaskModal.jsx    # Create/edit task
│   │       └── ProtectedRoute.jsx
│   ├── vite.config.js
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .vscode/
│   ├── launch.json
│   └── settings.json
└── README.md
```

---

## 📡 API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user profile |
| PATCH | `/api/auth/me` | Update profile (name) |

**Token usage:** Include `Authorization: Bearer <token>` in all protected requests.

---

### Workspaces

| Method | Endpoint | Description | Min Role |
|--------|----------|-------------|----------|
| GET | `/api/workspaces` | List my workspaces | any |
| POST | `/api/workspaces` | Create workspace | — |
| GET | `/api/workspaces/{id}` | Get workspace details | viewer |
| PATCH | `/api/workspaces/{id}` | Update workspace | owner |
| DELETE | `/api/workspaces/{id}` | Delete workspace | owner |
| POST | `/api/workspaces/{id}/invite` | Invite user (returns token) | editor |
| POST | `/api/workspaces/invitations/accept` | Accept invite by token | — |
| GET | `/api/workspaces/{id}/invitations` | List pending invitations | editor |
| PATCH | `/api/workspaces/{id}/members/{memberId}` | Change member role | owner |
| DELETE | `/api/workspaces/{id}/members/{userId}` | Remove member | owner |

---

### Notes

| Method | Endpoint | Description | Min Role |
|--------|----------|-------------|----------|
| GET | `/api/notes/workspace/{id}` | List notes in workspace | viewer |
| POST | `/api/notes` | Create note | editor |
| GET | `/api/notes/{id}` | Get note with versions | viewer |
| PATCH | `/api/notes/{id}` | Update note (creates version) | editor |
| DELETE | `/api/notes/{id}` | Delete note | editor |
| GET | `/api/notes/{id}/versions` | Get version history | viewer |
| POST | `/api/notes/{id}/comments` | Add comment | viewer |
| GET | `/api/notes/{id}/comments` | Get comments | viewer |

---

### Tasks

| Method | Endpoint | Description | Min Role |
|--------|----------|-------------|----------|
| GET | `/api/tasks/workspace/{id}/board` | Get full board with tasks | viewer |
| POST | `/api/tasks/workspace/{id}` | Create task | editor |
| PATCH | `/api/tasks/{id}` | Update task | editor |
| PATCH | `/api/tasks/{id}/move` | Move task (status + position) | editor |
| DELETE | `/api/tasks/{id}` | Delete task | editor |
| POST | `/api/tasks/{id}/comments` | Add task comment | viewer |
| GET | `/api/tasks/{id}/comments` | Get task comments | viewer |

---

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=query` | Search notes and tasks across all workspaces |

---

## 🔌 WebSocket Flow

### Connection

```
ws://localhost:8000/ws/{workspace_id}?token=<JWT>
```

Authentication is done via the `token` query parameter. The server verifies membership before upgrading the connection.

### Message Types (Server → Client)

```json
// Presence: sent on connect
{ "type": "presence:list", "active_users": [...] }

// User joined
{ "type": "presence:join", "user": {...}, "active_users": [...] }

// User left
{ "type": "presence:leave", "user": {...}, "active_users": [...] }

// Note events (broadcast to all workspace members)
{ "type": "note:create", "note": {...} }
{ "type": "note:update", "note": {...} }   // excludes the editor
{ "type": "note:delete", "note_id": 123 }

// Task events
{ "type": "task:create", "task": {...} }
{ "type": "task:update", "task": {...} }   // excludes the editor
{ "type": "task:delete", "task_id": 123 }

// Comment events
{ "type": "comment:new", "comment": {...} }
```

### Client → Server

```
ping   →   server responds: pong
```

### Connection Lifecycle

1. Client connects with JWT token in query string
2. Server verifies token + workspace membership
3. Server sends `presence:list` to new client
4. Server broadcasts `presence:join` to all others
5. On disconnect: server broadcasts `presence:leave`
6. Client auto-reconnects every 3 seconds if connection drops
7. Client sends ping every 25 seconds to keep connection alive

---

## 🗄️ Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| email | VARCHAR UNIQUE | |
| name | VARCHAR | |
| password_hash | VARCHAR | bcrypt hash |
| created_at | DATETIME | |

### workspaces
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| name | VARCHAR | |
| description | VARCHAR | |
| owner_id | FK → users | |
| created_at | DATETIME | |

### workspace_members
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| workspace_id | FK → workspaces | |
| user_id | FK → users | |
| role | ENUM(owner/editor/viewer) | |
| joined_at | DATETIME | |

### invitations
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| workspace_id | FK → workspaces | |
| email | VARCHAR | |
| role | ENUM | |
| token | VARCHAR UNIQUE | |
| status | ENUM(pending/accepted/declined) | |
| invited_by | FK → users | |

### notes
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| title | VARCHAR | |
| content | TEXT | Markdown |
| workspace_id | FK → workspaces | |
| created_by | FK → users | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### note_versions
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| note_id | FK → notes | |
| title | VARCHAR | |
| content | TEXT | |
| version_number | INTEGER | |
| created_by | FK → users | |
| created_at | DATETIME | |

### task_boards
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| workspace_id | FK → workspaces UNIQUE | |
| name | VARCHAR | |

### tasks
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| board_id | FK → task_boards | |
| title | VARCHAR | |
| description | TEXT | |
| status | ENUM(todo/in_progress/done) | |
| position | FLOAT | for ordering |
| created_by | FK → users | |
| assigned_to | FK → users | nullable |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### comments
| Column | Type | |
|--------|------|-|
| id | INTEGER PK | |
| content | TEXT | |
| user_id | FK → users | |
| note_id | FK → notes | nullable |
| task_id | FK → tasks | nullable |
| created_at | DATETIME | |

---

## 🔐 Role-Based Access Control

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| Read workspace/notes/tasks | ✅ | ✅ | ✅ |
| Create/edit/delete notes | ✅ | ✅ | ❌ |
| Create/edit/delete tasks | ✅ | ✅ | ❌ |
| Add comments | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |

---

## ⚙️ Design Decisions & Assumptions

1. **SQLite for simplicity** — Swappable to PostgreSQL by changing `DATABASE_URL` in `.env` to `postgresql+asyncpg://user:pass@host/db`. All SQLAlchemy async code works identically.

2. **Versioning** — Every save creates a new `NoteVersion`. Versions are pruned to the last 20 automatically (configurable via `MAX_VERSIONS`).

3. **Concurrent edits** — On simultaneous edits, last-write-wins via the REST API. The WebSocket broadcasts a `note:update` to all other connected users, and the frontend shows a banner notification. For production, an OT/CRDT approach would be implemented.

4. **WebSocket updates** — REST endpoints trigger WebSocket broadcasts. The editor is excluded from their own update broadcasts to avoid echo.

5. **Invitation flow** — Invitations return a token (mock email). The invitee pastes the token in the "Accept Invite" dialog. In production, the token would be emailed.

6. **Task ordering** — Tasks use a float `position` field. Drag-and-drop computes mid-point positions to avoid re-indexing the entire column.

7. **Ping/pong** — Client sends `ping` every 25s; server responds `pong`. This keeps WebSocket connections alive through proxies and load balancers.

8. **Auto-reconnect** — WebSocket client reconnects every 3 seconds on unexpected disconnection.

---

## ✨ Features

- ✅ JWT Authentication (register, login, profile)
- ✅ Workspace management with RBAC (owner/editor/viewer)
- ✅ Mock email invitations with token-based acceptance
- ✅ Real-time collaborative notes (Markdown + Preview + Split view)
- ✅ Note version history (last 20 versions, one-click restore)
- ✅ Real-time Kanban board (To Do / In Progress / Done)
- ✅ Drag-and-drop task ordering across columns
- ✅ Task assignment to workspace members
- ✅ Comments on notes and tasks
- ✅ Presence system (who's online in the workspace)
- ✅ Global search across notes and tasks
- ✅ Dark/Light theme toggle
- ✅ Auto-save with debounce (1.2s)
- ✅ Graceful WebSocket reconnection
- ✅ Concurrent edit notification banner
- ✅ Dockerized setup
