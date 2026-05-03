from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, default="Untitled")
    content = Column(Text, nullable=True, default="")
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="notes")
    creator = relationship("User", back_populates="notes", foreign_keys=[created_by])
    versions = relationship(
        "NoteVersion",
        back_populates="note",
        order_by="NoteVersion.version_number.desc()",
        cascade="all, delete-orphan",
    )
    comments = relationship("Comment", back_populates="note", cascade="all, delete-orphan")


class NoteVersion(Base):
    __tablename__ = "note_versions"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    version_number = Column(Integer, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    note = relationship("Note", back_populates="versions")
    creator = relationship("User", back_populates="note_versions")
