from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.note import Note, NoteVersion
from app.models.task import Task, TaskBoard
from app.models.workspace import WorkspaceMember
from app.utils.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def global_search(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get user's workspace IDs
    ws_result = await db.execute(
        select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == current_user.id)
    )
    workspace_ids = [row[0] for row in ws_result.all()]

    if not workspace_ids:
        return {"notes": [], "tasks": []}

    pattern = f"%{q}%"

    # Search notes
    notes_result = await db.execute(
        select(Note)
        .where(
            Note.workspace_id.in_(workspace_ids),
            or_(Note.title.ilike(pattern), Note.content.ilike(pattern)),
        )
        .options(selectinload(Note.creator))
        .limit(20)
    )
    notes = notes_result.scalars().all()

    # Search tasks
    tasks_result = await db.execute(
        select(Task)
        .join(TaskBoard, Task.board_id == TaskBoard.id)
        .where(
            TaskBoard.workspace_id.in_(workspace_ids),
            or_(Task.title.ilike(pattern), Task.description.ilike(pattern)),
        )
        .options(selectinload(Task.creator), selectinload(Task.assignee))
        .limit(20)
    )
    tasks = tasks_result.scalars().all()

    return {
        "notes": [
            {
                "id": n.id,
                "title": n.title,
                "workspace_id": n.workspace_id,
                "updated_at": n.updated_at,
                "creator": {"id": n.creator.id, "name": n.creator.name},
            }
            for n in notes
        ],
        "tasks": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status.value,
                "board_id": t.board_id,
                "creator": {"id": t.creator.id, "name": t.creator.name},
            }
            for t in tasks
        ],
    }
