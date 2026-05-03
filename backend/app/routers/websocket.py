from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import AsyncSessionLocal
from app.models.workspace import WorkspaceMember
from app.models.user import User
from app.utils.security import decode_token
from app.services.websocket_manager import manager

router = APIRouter()


@router.websocket("/{workspace_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    workspace_id: int,
    token: str = Query(...),
):
    # Authenticate via token query param
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid token payload")
        return

    user_id = int(user_id_str)

    async with AsyncSessionLocal() as db:
        # Verify workspace membership
        result = await db.execute(
            select(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
            .options(selectinload(WorkspaceMember.user))
        )
        member = result.scalar_one_or_none()
        if not member:
            await websocket.close(code=4003, reason="Not a workspace member")
            return

        user_info = {
            "id": member.user.id,
            "name": member.user.name,
            "email": member.user.email,
            "role": member.role.value,
        }

    await manager.connect(websocket, workspace_id, user_id, user_info)

    try:
        while True:
            # Keep connection alive; all updates are server-pushed via REST triggers
            data = await websocket.receive_text()
            # Handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(workspace_id, user_id)
    except Exception:
        await manager.disconnect(workspace_id, user_id)
