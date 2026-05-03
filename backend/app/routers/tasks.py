from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.task import TaskBoard, Task, TaskStatus, Comment
from app.models.workspace import UserRole
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskMoveRequest,
    TaskResponse, TaskBoardResponse, CommentCreate, CommentResponse,
)
from app.utils.dependencies import get_current_user, get_workspace_member_or_403
from app.services.websocket_manager import manager

router = APIRouter()


async def _get_board(db: AsyncSession, workspace_id: int) -> TaskBoard:
    result = await db.execute(
        select(TaskBoard).where(TaskBoard.workspace_id == workspace_id)
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Task board not found")
    return board


async def _load_task(db: AsyncSession, task_id: int) -> Task:
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.creator),
            selectinload(Task.assignee),
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/workspace/{workspace_id}/board", response_model=TaskBoardResponse)
async def get_board(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db)
    result = await db.execute(
        select(TaskBoard)
        .where(TaskBoard.workspace_id == workspace_id)
        .options(
            selectinload(TaskBoard.tasks).selectinload(Task.creator),
            selectinload(TaskBoard.tasks).selectinload(Task.assignee),
        )
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@router.post("/workspace/{workspace_id}", response_model=TaskResponse, status_code=201)
async def create_task(
    workspace_id: int,
    data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.editor)
    board = await _get_board(db, workspace_id)

    # Compute next position in the column
    result = await db.execute(
        select(Task)
        .where(Task.board_id == board.id, Task.status == data.status)
        .order_by(Task.position.desc())
        .limit(1)
    )
    last_task = result.scalar_one_or_none()
    position = (last_task.position + 1000.0) if last_task else 1000.0

    task = Task(
        board_id=board.id,
        title=data.title,
        description=data.description,
        status=data.status,
        position=position,
        created_by=current_user.id,
        assigned_to=data.assigned_to,
    )
    db.add(task)
    await db.commit()

    loaded = await _load_task(db, task.id)
    task_data = TaskResponse.model_validate(loaded).model_dump()
    await manager.broadcast_task_created(workspace_id, task_data)
    return loaded


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _load_task(db, task_id)

    # Get workspace_id from board
    board_result = await db.execute(
        select(TaskBoard).where(TaskBoard.id == task.board_id)
    )
    board = board_result.scalar_one()
    await get_workspace_member_or_403(board.workspace_id, current_user, db, required_role=UserRole.editor)

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.status is not None:
        task.status = data.status
    if data.position is not None:
        task.position = data.position
    if data.assigned_to is not None:
        task.assigned_to = data.assigned_to

    await db.commit()
    loaded = await _load_task(db, task.id)
    task_data = TaskResponse.model_validate(loaded).model_dump()
    await manager.broadcast_task_update(board.workspace_id, task_data, current_user.id)
    return loaded


@router.patch("/{task_id}/move", response_model=TaskResponse)
async def move_task(
    task_id: int,
    data: TaskMoveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _load_task(db, task_id)
    board_result = await db.execute(select(TaskBoard).where(TaskBoard.id == task.board_id))
    board = board_result.scalar_one()
    await get_workspace_member_or_403(board.workspace_id, current_user, db, required_role=UserRole.editor)

    task.status = data.status
    task.position = data.position
    await db.commit()

    loaded = await _load_task(db, task.id)
    task_data = TaskResponse.model_validate(loaded).model_dump()
    await manager.broadcast_task_update(board.workspace_id, task_data, current_user.id)
    return loaded


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _load_task(db, task_id)
    board_result = await db.execute(select(TaskBoard).where(TaskBoard.id == task.board_id))
    board = board_result.scalar_one()
    await get_workspace_member_or_403(board.workspace_id, current_user, db, required_role=UserRole.editor)

    workspace_id = board.workspace_id
    await db.delete(task)
    await db.commit()
    await manager.broadcast_task_deleted(workspace_id, task_id)


@router.post("/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    task_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _load_task(db, task_id)
    board_result = await db.execute(select(TaskBoard).where(TaskBoard.id == task.board_id))
    board = board_result.scalar_one()
    await get_workspace_member_or_403(board.workspace_id, current_user, db)

    comment = Comment(content=data.content, user_id=current_user.id, task_id=task_id)
    db.add(comment)
    await db.commit()

    result = await db.execute(
        select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.user))
    )
    loaded = result.scalar_one()
    comment_data = CommentResponse.model_validate(loaded).model_dump()
    await manager.broadcast_comment(board.workspace_id, comment_data)
    return loaded


@router.get("/{task_id}/comments", response_model=list[CommentResponse])
async def get_task_comments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    task = await _load_task(db, task_id)
    board_result = await db.execute(select(TaskBoard).where(TaskBoard.id == task.board_id))
    board = board_result.scalar_one()
    await get_workspace_member_or_403(board.workspace_id, current_user, db)

    result = await db.execute(
        select(Comment)
        .where(Comment.task_id == task_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()
