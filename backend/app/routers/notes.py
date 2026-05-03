from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.note import Note, NoteVersion
from app.models.task import Comment
from app.models.workspace import UserRole
from app.schemas.note import NoteCreate, NoteUpdate, NoteResponse, NoteVersionResponse, CommentCreate, CommentResponse
from app.utils.dependencies import get_current_user, get_workspace_member_or_403
from app.services.websocket_manager import manager

router = APIRouter()

MAX_VERSIONS = 20


async def _load_note(db: AsyncSession, note_id: int) -> Note:
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id)
        .options(
            selectinload(Note.creator),
            selectinload(Note.versions).selectinload(NoteVersion.creator),
            selectinload(Note.comments).selectinload(Comment.user),
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("", response_model=NoteResponse, status_code=201)
async def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(data.workspace_id, current_user, db, required_role=UserRole.editor)

    note = Note(
        title=data.title,
        content=data.content,
        workspace_id=data.workspace_id,
        created_by=current_user.id,
    )
    db.add(note)
    await db.flush()

    version = NoteVersion(
        note_id=note.id,
        title=data.title,
        content=data.content,
        version_number=1,
        created_by=current_user.id,
    )
    db.add(version)
    await db.commit()

    loaded = await _load_note(db, note.id)
    note_data = NoteResponse.model_validate(loaded).model_dump()

    await manager.broadcast_note_created(data.workspace_id, note_data)
    return loaded


@router.get("/workspace/{workspace_id}", response_model=list[NoteResponse])
async def list_notes(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db)
    result = await db.execute(
        select(Note)
        .where(Note.workspace_id == workspace_id)
        .options(
            selectinload(Note.creator),
            selectinload(Note.versions).selectinload(NoteVersion.creator),
        )
        .order_by(Note.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db)
    return note


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db, required_role=UserRole.editor)

    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content

    # Get next version number
    version_count_result = await db.execute(
        select(func.count()).where(NoteVersion.note_id == note_id)
    )
    version_count = version_count_result.scalar()
    next_version = (version_count or 0) + 1

    version = NoteVersion(
        note_id=note.id,
        title=note.title,
        content=note.content,
        version_number=next_version,
        created_by=current_user.id,
    )
    db.add(version)

    # Prune old versions (keep last MAX_VERSIONS)
    if version_count and version_count >= MAX_VERSIONS:
        old_versions_result = await db.execute(
            select(NoteVersion)
            .where(NoteVersion.note_id == note_id)
            .order_by(NoteVersion.version_number.asc())
            .limit(version_count - MAX_VERSIONS + 1)
        )
        for old_v in old_versions_result.scalars().all():
            await db.delete(old_v)

    await db.commit()

    loaded = await _load_note(db, note.id)
    note_data = NoteResponse.model_validate(loaded).model_dump()
    await manager.broadcast_note_update(note.workspace_id, note_data, current_user.id)
    return loaded


@router.delete("/{note_id}", status_code=204)
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db, required_role=UserRole.editor)
    workspace_id = note.workspace_id
    await db.delete(note)
    await db.commit()
    await manager.broadcast_note_deleted(workspace_id, note_id)


@router.get("/{note_id}/versions", response_model=list[NoteVersionResponse])
async def get_note_versions(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db)
    result = await db.execute(
        select(NoteVersion)
        .where(NoteVersion.note_id == note_id)
        .options(selectinload(NoteVersion.creator))
        .order_by(NoteVersion.version_number.desc())
    )
    return result.scalars().all()


@router.post("/{note_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment(
    note_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db)

    comment = Comment(content=data.content, user_id=current_user.id, note_id=note_id)
    db.add(comment)
    await db.commit()

    result = await db.execute(
        select(Comment).where(Comment.id == comment.id).options(selectinload(Comment.user))
    )
    loaded_comment = result.scalar_one()
    comment_data = CommentResponse.model_validate(loaded_comment).model_dump()
    await manager.broadcast_comment(note.workspace_id, comment_data)
    return loaded_comment


@router.get("/{note_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _load_note(db, note_id)
    await get_workspace_member_or_403(note.workspace_id, current_user, db)
    result = await db.execute(
        select(Comment)
        .where(Comment.note_id == note_id)
        .options(selectinload(Comment.user))
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()
