from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.task import TaskStatus
from app.schemas.user import UserResponse


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.todo
    assigned_to: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    position: Optional[float] = None
    assigned_to: Optional[int] = None


class TaskMoveRequest(BaseModel):
    status: TaskStatus
    position: float


class TaskResponse(BaseModel):
    id: int
    board_id: int
    title: str
    description: Optional[str]
    status: TaskStatus
    position: float
    created_by: int
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime
    creator: UserResponse
    assignee: Optional[UserResponse] = None

    model_config = {"from_attributes": True}


class TaskBoardResponse(BaseModel):
    id: int
    workspace_id: int
    name: str
    tasks: List[TaskResponse] = []

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
