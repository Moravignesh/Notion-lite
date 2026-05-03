from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workspace_members = relationship("WorkspaceMember", back_populates="user")
    notes = relationship("Note", back_populates="creator", foreign_keys="Note.created_by")
    note_versions = relationship("NoteVersion", back_populates="creator")
    tasks_created = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")
    tasks_assigned = relationship("Task", back_populates="assignee", foreign_keys="Task.assigned_to")
    comments = relationship("Comment", back_populates="user")
