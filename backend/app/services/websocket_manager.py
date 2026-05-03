from fastapi import WebSocket
from typing import Dict, List
import asyncio
import json


class ConnectionManager:
    def __init__(self):
        # workspace_id -> {user_id: WebSocket}
        self.active_connections: Dict[int, Dict[int, WebSocket]] = {}
        # workspace_id -> {user_id: user_info_dict}
        self.presence: Dict[int, Dict[int, dict]] = {}
        # note_id -> set of user_ids currently editing
        self.note_editors: Dict[int, set] = {}

    async def connect(
        self,
        websocket: WebSocket,
        workspace_id: int,
        user_id: int,
        user_info: dict,
    ):
        await websocket.accept()
        if workspace_id not in self.active_connections:
            self.active_connections[workspace_id] = {}
            self.presence[workspace_id] = {}

        self.active_connections[workspace_id][user_id] = websocket
        self.presence[workspace_id][user_id] = user_info

        # Send current presence list to the newly connected user
        await self._send(websocket, {
            "type": "presence:list",
            "active_users": list(self.presence[workspace_id].values()),
        })

        # Notify others
        await self.broadcast(
            workspace_id,
            {
                "type": "presence:join",
                "user": user_info,
                "active_users": list(self.presence[workspace_id].values()),
            },
            exclude_user=user_id,
        )

    async def disconnect(self, workspace_id: int, user_id: int):
        if workspace_id not in self.active_connections:
            return

        self.active_connections[workspace_id].pop(user_id, None)
        user_info = self.presence[workspace_id].pop(user_id, None)

        # Clean up note editors
        for note_id, editors in self.note_editors.items():
            editors.discard(user_id)

        if not self.active_connections[workspace_id]:
            del self.active_connections[workspace_id]
            del self.presence[workspace_id]
        else:
            await self.broadcast(
                workspace_id,
                {
                    "type": "presence:leave",
                    "user": user_info,
                    "active_users": list(self.presence[workspace_id].values()),
                },
            )

    async def broadcast(
        self,
        workspace_id: int,
        message: dict,
        exclude_user: int = None,
    ):
        if workspace_id not in self.active_connections:
            return

        dead_connections: List[int] = []
        for uid, ws in self.active_connections[workspace_id].items():
            if uid == exclude_user:
                continue
            try:
                await self._send(ws, message)
            except Exception:
                dead_connections.append(uid)

        for uid in dead_connections:
            await self.disconnect(workspace_id, uid)

    async def broadcast_note_update(self, workspace_id: int, note_data: dict, editor_user_id: int):
        await self.broadcast(
            workspace_id,
            {"type": "note:update", "note": note_data},
            exclude_user=editor_user_id,
        )

    async def broadcast_note_created(self, workspace_id: int, note_data: dict):
        await self.broadcast(workspace_id, {"type": "note:create", "note": note_data})

    async def broadcast_note_deleted(self, workspace_id: int, note_id: int):
        await self.broadcast(workspace_id, {"type": "note:delete", "note_id": note_id})

    async def broadcast_task_update(self, workspace_id: int, task_data: dict, editor_user_id: int):
        await self.broadcast(
            workspace_id,
            {"type": "task:update", "task": task_data},
            exclude_user=editor_user_id,
        )

    async def broadcast_task_created(self, workspace_id: int, task_data: dict):
        await self.broadcast(workspace_id, {"type": "task:create", "task": task_data})

    async def broadcast_task_deleted(self, workspace_id: int, task_id: int):
        await self.broadcast(workspace_id, {"type": "task:delete", "task_id": task_id})

    async def broadcast_comment(self, workspace_id: int, comment_data: dict):
        await self.broadcast(workspace_id, {"type": "comment:new", "comment": comment_data})

    async def _send(self, websocket: WebSocket, message: dict):
        await websocket.send_text(json.dumps(message, default=str))

    def get_active_users(self, workspace_id: int) -> List[dict]:
        return list(self.presence.get(workspace_id, {}).values())


manager = ConnectionManager()
