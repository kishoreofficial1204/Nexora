"""
Applications Router for VeriScope.
Handles case queue listing, application creation, and pre-seeded demo bundles.
"""

import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from apps.api.db.database import get_db
from apps.api.models.user import User, UserRole
from apps.api.models.institution import Institution
from apps.api.models.application import Application, ApplicationStatus
from apps.api.models.document import Document, DocumentSourceStatus
from apps.api.models.audit import AuditAction
from apps.api.schemas.models_schema import ApplicationCreate, ApplicationOut, InstitutionOut
from apps.api.core.security import get_current_user, require_roles
from apps.api.core.audit_logger import log_audit_event
from apps.api.services.storage import storage_service
import fitz

router = APIRouter(prefix="/api/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationOut])
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_filter: Optional[str] = Query(None, alias="category"),
    year_filter: Optional[str] = Query(None, alias="year"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Application).order_by(desc(Application.created_at))

    # RBAC: Applicants see only their own applications
    if current_user.role == UserRole.APPLICANT:
        query = query.filter(Application.created_by_id == current_user.id)

    if status_filter:
        query = query.filter(Application.status == status_filter)
    if category_filter:
        query = query.filter(Application.category == category_filter)
    if year_filter:
        query = query.filter(Application.academic_year == year_filter)

    return query.all()


@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    app_in: ApplicationCreate,
    current_user: User = Depends(require_roles([UserRole.APPLICANT, UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    # Ensure institution exists or use default demo institution
    inst_id = app_in.institution_id
    if not inst_id:
        default_inst = db.query(Institution).filter(Institution.permanent_id == "1-9876543210").first()
        if not default_inst:
            raise HTTPException(status_code=400, detail="Default demo institution not initialized. Run seed script.")
        inst_id = default_inst.id

    application = Application(
        institution_id=inst_id,
        category=app_in.category,
        academic_year=app_in.academic_year,
        assessment_date=app_in.assessment_date,
        status=ApplicationStatus.PRELIMINARY_REVIEW,
        rule_pack_id=app_in.rule_pack_id,
        created_by_id=current_user.id
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    # Log immutable audit event
    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.APPLICATION_CREATED,
        entity_type="application",
        entity_id=application.id,
        metadata={
            "category": application.category,
            "academic_year": application.academic_year,
            "assessment_date": application.assessment_date,
            "institution_id": application.institution_id,
            "rule_pack_id": application.rule_pack_id
        }
    )

    return application


@router.get("/{id}", response_model=ApplicationOut)
def get_application(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(Application.id == id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application case not found.")

    if current_user.role == UserRole.APPLICANT and app.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this application.")

    return app


@router.post("/seed-demo", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def seed_demo_application(
    bundle_key: str = Query("bundle_a_clean", description="Key of synthetic bundle to load"),
    current_user: User = Depends(require_roles([UserRole.REVIEWER, UserRole.SENIOR_REVIEWER, UserRole.ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Instantly provisions an application from one of the 9 pre-seeded synthetic bundles
    with full safe document intake and audit logs.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    bundle_dir = os.path.join(project_root, "data", "synthetic", "bundles", bundle_key)

    if not os.path.isdir(bundle_dir):
        raise HTTPException(status_code=400, detail=f"Synthetic bundle '{bundle_key}' not found.")

    # Find institution
    inst = db.query(Institution).filter(Institution.permanent_id == "1-9876543210").first()
    if not inst:
        raise HTTPException(status_code=500, detail="Seed institution not found.")

    # Create application
    app = Application(
        institution_id=inst.id,
        category="Extension of Approval (EoA)",
        academic_year="2026-27",
        assessment_date="2026-10-26",
        status=ApplicationStatus.PRELIMINARY_REVIEW,
        rule_pack_id="pack_eoa_ug_2026",
        created_by_id=current_user.id
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Ingest bundle documents
    app_storage_dir = os.path.join(storage_service.storage_dir, app.id)
    os.makedirs(app_storage_dir, exist_ok=True)

    type_mapping = {
        "doc_eoa_app": "doc_eoa_app",
        "doc_prev_eoa": "doc_prev_eoa",
        "doc_univ_affil": "doc_univ_affil",
        "doc_fire_safety": "doc_fire_safety",
        "doc_building_stability": "doc_building_stability",
        "doc_infra_photos": "doc_infra_photos"
    }

    import hashlib
    for fname in sorted(os.listdir(bundle_dir)):
        if not fname.endswith(".pdf"):
            continue

        src_path = os.path.join(bundle_dir, fname)
        with open(src_path, "rb") as f:
            content = f.read()

        sha256 = hashlib.sha256(content).hexdigest()
        dest_filename = f"{sha256[:16]}_{fname}"
        dest_path = os.path.join(app_storage_dir, dest_filename)
        shutil.copy(src_path, dest_path)

        # Detect type from prefix
        doc_type = "unknown"
        for prefix, dtype in type_mapping.items():
            if fname.startswith(prefix):
                doc_type = dtype
                break

        pdf = fitz.open(dest_path)
        page_count = pdf.page_count
        pdf.close()

        doc_rec = Document(
            application_id=app.id,
            document_type=doc_type,
            filename=dest_filename,
            original_filename=fname,
            file_size=len(content),
            mime_type="application/pdf",
            hash_sha256=sha256,
            storage_path=dest_path,
            page_count=page_count,
            source_status=DocumentSourceStatus.UPLOADED
        )
        db.add(doc_rec)
        db.commit()
        db.refresh(doc_rec)

        log_audit_event(
            db=db,
            actor_id=current_user.id,
            action=AuditAction.DOCUMENT_UPLOADED,
            entity_type="document",
            entity_id=doc_rec.id,
            metadata={
                "application_id": app.id,
                "original_filename": fname,
                "sha256": sha256,
                "document_type": doc_type,
                "page_count": page_count,
                "bundle_key": bundle_key
            }
        )

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.APPLICATION_CREATED,
        entity_type="application",
        entity_id=app.id,
        metadata={"seeded_from_bundle": bundle_key}
    )

    db.refresh(app)
    return app
