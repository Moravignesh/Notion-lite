from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.schemas.user import UserResponse


class NoteCreate(BaseModel):
    title: str = "Untitled"
    content: str = ""
    workspace_id: int


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class NoteVersionResponse(BaseModel):
    id: int
    note_id: int
    title: str
    content: Optional[str]
    version_number: int
    created_by: int
    created_at: datetime
    creator: UserResponse

    model_config = {"from_attributes": True}


class NoteResponse(BaseModel):
    id: int
    title: str
    content: Optional[str]
    workspace_id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    creator: UserResponse
    versions: List[NoteVersionResponse] = []

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    content: str
    user_id: int
    note_id: Optional[int]
    task_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    user: UserResponse

    model_config = {"from_attributes": True}
