from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from app.models.workspace import UserRole, InvitationStatus
from app.schemas.user import UserResponse


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkspaceMemberResponse(BaseModel):
    id: int
    user_id: int
    role: UserRole
    joined_at: datetime
    user: UserResponse

    model_config = {"from_attributes": True}


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    members: List[WorkspaceMemberResponse] = []

    model_config = {"from_attributes": True}


class InviteRequest(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.editor


class InvitationResponse(BaseModel):
    id: int
    workspace_id: int
    email: str
    role: UserRole
    status: InvitationStatus
    token: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AcceptInviteRequest(BaseModel):
    token: str


class MemberRoleUpdate(BaseModel):
    role: UserRole
