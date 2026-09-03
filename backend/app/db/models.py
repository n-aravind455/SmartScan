"""Smart Scan — SQLAlchemy database models."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Integer, Text, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class ScanTransaction(Base):
    """Represents a single scan processing transaction."""

    __tablename__ = "scan_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(255), unique=True, nullable=False, index=True)
    filename = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="PENDING")
    image_url = Column(Text, nullable=True)
    report_url = Column(Text, nullable=True)

    # Compliance results stored as JSON
    compliance_verdict = Column(String(20), nullable=True)
    compliance_result = Column(JSON, nullable=True)
    cv_analysis = Column(JSON, nullable=True)
    extracted_fields = Column(JSON, nullable=True)

    # Warnings
    curvature_warning = Column(Boolean, default=False)
    glare_detected = Column(Boolean, default=False)

    # Metadata
    total_checks = Column(Integer, default=0)
    passed_checks = Column(Integer, default=0)
    failed_checks = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ScanTransaction(task_id={self.task_id}, status={self.status}, verdict={self.compliance_verdict})>"

class Complaint(Base):
    """Represents a complaint filed against a non-compliant product."""
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(255), nullable=False)
    location = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="OPEN") # OPEN or SOLVED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<Complaint(id={self.id}, status={self.status})>"
