import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, Invitation, UserRole, InvitationStatus
from app.models.task import TaskBoard
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    InviteRequest, InvitationResponse, AcceptInviteRequest, MemberRoleUpdate,
)
from app.utils.dependencies import get_current_user, get_workspace_member_or_403

router = APIRouter()


async def _load_workspace(db: AsyncSession, workspace_id: int) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .where(Workspace.id == workspace_id)
        .options(
            selectinload(Workspace.members).selectinload(WorkspaceMember.user),
        )
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ws = Workspace(name=data.name, description=data.description, owner_id=current_user.id)
    db.add(ws)
    await db.flush()

    member = WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role=UserRole.owner)
    db.add(member)

    board = TaskBoard(workspace_id=ws.id, name="Task Board")
    db.add(board)

    await db.commit()
    return await _load_workspace(db, ws.id)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .options(selectinload(Workspace.members).selectinload(WorkspaceMember.user))
    )
    return result.scalars().all()


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db)
    return await _load_workspace(db, workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.owner)
    ws = await _load_workspace(db, workspace_id)
    if data.name is not None:
        ws.name = data.name
    if data.description is not None:
        ws.description = data.description
    await db.commit()
    return await _load_workspace(db, workspace_id)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.owner)
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = result.scalar_one_or_none()
    if ws:
        await db.delete(ws)
        await db.commit()


@router.post("/{workspace_id}/invite", response_model=InvitationResponse, status_code=201)
async def invite_user(
    workspace_id: int,
    data: InviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.editor)

    # Check if already a member
    user_result = await db.execute(select(User).where(User.email == data.email))
    invited_user = user_result.scalar_one_or_none()
    if invited_user:
        existing = await db.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == invited_user.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User is already a member")

    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        workspace_id=workspace_id,
        email=data.email,
        role=data.role,
        token=token,
        invited_by=current_user.id,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    # In production, send email here. Token returned for mock purposes.
    return invitation


@router.post("/invitations/accept", response_model=WorkspaceResponse)
async def accept_invitation(
    data: AcceptInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(
            Invitation.token == data.token,
            Invitation.status == InvitationStatus.pending,
        )
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation")

    if invitation.email != current_user.email:
        raise HTTPException(status_code=403, detail="Invitation is for a different email")

    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == invitation.workspace_id,
            WorkspaceMember.user_id == current_user.id,
        )
    )
    if not existing.scalar_one_or_none():
        member = WorkspaceMember(
            workspace_id=invitation.workspace_id,
            user_id=current_user.id,
            role=invitation.role,
        )
        db.add(member)

    invitation.status = InvitationStatus.accepted
    await db.commit()
    return await _load_workspace(db, invitation.workspace_id)


@router.get("/{workspace_id}/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.editor)
    result = await db.execute(
        select(Invitation).where(Invitation.workspace_id == workspace_id)
    )
    return result.scalars().all()


@router.patch("/{workspace_id}/members/{member_id}", response_model=dict)
async def update_member_role(
    workspace_id: int,
    member_id: int,
    data: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.owner)
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == workspace_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    member.role = data.role
    await db.commit()
    return {"message": "Role updated"}


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member(
    workspace_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_workspace_member_or_403(workspace_id, current_user, db, required_role=UserRole.owner)
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    await db.delete(member)
    await db.commit()
