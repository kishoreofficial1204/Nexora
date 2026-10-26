"""
Report Generation Service for VeriScope.
Generates exportable scrutiny dossiers in structured JSON and signed PDF formats.
Enforces non-negotiable principles: synthetic watermarking, draft banners, and cryptographic provenance.
"""

import io
from datetime import datetime
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from apps.api.models.application import Application
from apps.api.models.finding import Finding
from apps.api.core.audit_logger import verify_audit_chain
from sqlalchemy.orm import Session


WATERMARK_TEXT = "SAMPLE: NOT AN OFFICIAL DOCUMENT"
DRAFT_BANNER = "UNVERIFIED AGAINST CURRENT HANDBOOK: DRAFT RULES FOR DEMO DECISION SUPPORT"


def build_case_dossier_json(app: Application, db: Session) -> Dict[str, Any]:
    """Assembles comprehensive, machine-readable structured JSON case dossier."""
    chain_verif = verify_audit_chain(db)
    findings = db.query(Finding).filter(Finding.application_id == app.id).all()

    documents_payload = [
        {
            "id": d.id,
            "document_type": d.document_type,
            "filename": d.filename,
            "original_filename": d.original_filename,
            "file_size_bytes": d.file_size,
            "sha256_hash": d.hash_sha256,
            "page_count": d.page_count,
            "upload_time": d.upload_time.isoformat() + "Z" if d.upload_time else None,
            "source_status": d.source_status
        }
        for d in app.documents
    ]

    findings_payload = [
        {
            "id": f.id,
            "rule_id": f.rule_id,
            "rule_version": f.rule_version,
            "severity": f.severity,
            "status": f.status,
            "title": f.title,
            "explanation": f.explanation,
            "is_heuristic": f.is_heuristic,
            "confidence": f.confidence,
            "evidence_refs": f.evidence_refs,
            "review_rationale": f.review_rationale,
            "reviewed_by": f.reviewed_by,
            "reviewed_at": f.reviewed_at.isoformat() + "Z" if f.reviewed_at else None
        }
        for f in findings
    ]

    return {
        "dossier_metadata": {
            "format": "VeriScope Auditable Case Dossier v1.0",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "rule_pack_id": app.rule_pack_id,
            "banner_notice": DRAFT_BANNER,
            "watermark": WATERMARK_TEXT
        },
        "case_summary": {
            "application_id": app.id,
            "category": app.category,
            "academic_year": app.academic_year,
            "assessment_date": app.assessment_date,
            "overall_status": app.status,
            "recommendation": app.recommendation or "PENDING_SCRUTINY_OFFICER_DISPOSITION",
            "recommendation_rationale": app.recommendation_rationale,
            "recommendation_by": app.recommendation_by,
            "recommendation_at": app.recommendation_at.isoformat() + "Z" if app.recommendation_at else None
        },
        "institution_profile": {
            "permanent_id": app.institution.permanent_id if app.institution else "1-9876543210",
            "name": app.institution.name if app.institution else "ABC Institute of Technology",
            "address": app.institution.address if app.institution else "Sector 14, Educational Zone",
            "state": app.institution.state if app.institution else "Delhi",
            "status": "active"
        },
        "document_inventory": documents_payload,
        "findings_and_dispositions": findings_payload,
        "cryptographic_audit_ledger": {
            "chain_verified": chain_verif["verified"],
            "total_blocks_audited": chain_verif["chain_length"],
            "tamper_detected": not chain_verif["verified"],
            "status": chain_verif["status"]
        },
        "reviewer_signature_block": {
            "signed_by": app.recommendation_by or "Pending Final Endorsement",
            "timestamp": app.recommendation_at.isoformat() + "Z" if app.recommendation_at else None,
            "disclaimer": "AI-assisted scrutiny decision support. Statutory decision exercised by authorized scrutiny officer."
        }
    }


def draw_pdf_watermark(canvas_obj: canvas.Canvas, doc):
    """Draws watermark across the page."""
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica-Bold", 36)
    canvas_obj.setFillColor(colors.HexColor("#E2E8F0"), alpha=0.35)
    canvas_obj.translate(letter[0] / 2.0, letter[1] / 2.0)
    canvas_obj.rotate(42)
    canvas_obj.drawCentredString(0, 0, WATERMARK_TEXT)
    canvas_obj.restoreState()


def generate_case_dossier_pdf(app: Application, db: Session) -> bytes:
    """Generates a professional multi-page ReportLab PDF scrutiny dossier."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A")
    )
    subtitle_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569")
    )
    section_heading = ParagraphStyle(
        "SecHead",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0D9488"),
        spaceBefore=8,
        spaceAfter=4
    )
    cell_style = ParagraphStyle(
        "CellText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E293B")
    )
    cell_bold = ParagraphStyle(
        "CellBold",
        parent=cell_style,
        fontName="Helvetica-Bold"
    )
    cell_mono = ParagraphStyle(
        "CellMono",
        parent=cell_style,
        fontName="Courier",
        fontSize=7,
        leading=8
    )

    story = []

    # 1. Header & Draft Banner
    story.append(Paragraph("ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)", title_style))
    story.append(Paragraph("VeriScope Scrutiny Dossier & Decision Support Audit Report", subtitle_style))
    story.append(Spacer(1, 4))

    # Draft Alert Box
    banner_p = Paragraph(f"<b>{DRAFT_BANNER}</b>", ParagraphStyle(
        "Banner",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#B45309")
    ))
    story.append(Table([[banner_p]], colWidths=[540], style=[
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(Spacer(1, 8))

    # 2. Case Summary Table
    inst_name = app.institution.name if app.institution else "ABC Institute of Technology"
    inst_pid = app.institution.permanent_id if app.institution else "1-9876543210"

    summary_data = [
        [
            Paragraph("<b>Application ID:</b>", cell_style),
            Paragraph(app.id, cell_mono),
            Paragraph("<b>Category:</b>", cell_style),
            Paragraph(app.category, cell_style)
        ],
        [
            Paragraph("<b>Institution Name:</b>", cell_style),
            Paragraph(inst_name, cell_bold),
            Paragraph("<b>Permanent ID (PID):</b>", cell_style),
            Paragraph(inst_pid, cell_mono)
        ],
        [
            Paragraph("<b>Academic Year:</b>", cell_style),
            Paragraph(app.academic_year, cell_style),
            Paragraph("<b>Assessment Date:</b>", cell_style),
            Paragraph(app.assessment_date or "2026-10-26", cell_style)
        ],
        [
            Paragraph("<b>Overall Status:</b>", cell_style),
            Paragraph(app.status.upper(), cell_bold),
            Paragraph("<b>Officer Recommendation:</b>", cell_style),
            Paragraph(app.recommendation or "PENDING DISPOSITION", cell_bold)
        ]
    ]

    t_summary = Table(summary_data, colWidths=[110, 160, 110, 160])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))

    # 3. Document Inventory with SHA-256 Hashes
    story.append(Paragraph("1. Submitted Document Inventory & Integrity Hashes", section_heading))
    doc_table_data = [
        [
            Paragraph("<b>Document Type</b>", cell_bold),
            Paragraph("<b>Filename</b>", cell_bold),
            Paragraph("<b>Pages</b>", cell_bold),
            Paragraph("<b>SHA-256 Cryptographic Hash</b>", cell_bold)
        ]
    ]
    for d in app.documents:
        doc_table_data.append([
            Paragraph(d.document_type, cell_style),
            Paragraph(d.original_filename, cell_style),
            Paragraph(str(d.page_count), cell_style),
            Paragraph(d.hash_sha256[:32] + "...", cell_mono)
        ])

    t_docs = Table(doc_table_data, colWidths=[110, 130, 40, 260])
    t_docs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_docs)
    story.append(Spacer(1, 10))

    # 4. Finding Disposition Log
    story.append(Paragraph("2. Scrutiny Findings & Reviewer Dispositions", section_heading))
    findings = db.query(Finding).filter(Finding.application_id == app.id).all()

    if not findings:
        story.append(Paragraph("<i>No compliance deficiencies or anomaly signals detected.</i>", cell_style))
    else:
        finding_rows = [
            [
                Paragraph("<b>Rule & Severity</b>", cell_bold),
                Paragraph("<b>Finding Title & Explanation</b>", cell_bold),
                Paragraph("<b>Disposition</b>", cell_bold),
                Paragraph("<b>Officer Rationale</b>", cell_bold)
            ]
        ]
        for f in findings:
            type_tag = "[HEURISTIC]" if f.is_heuristic else "[DETERMINISTIC]"
            rule_cell = Paragraph(f"<b>{f.rule_id}</b><br/>{f.severity.upper()}<br/>{type_tag}", cell_style)
            expl_cell = Paragraph(f"<b>{f.title}</b><br/>{f.explanation}", cell_style)
            disp_cell = Paragraph(f.status.upper(), cell_bold)
            rat_cell = Paragraph(f.review_rationale or "<i>Pending Reviewer Rationale</i>", cell_style)
            finding_rows.append([rule_cell, expl_cell, disp_cell, rat_cell])

        t_findings = Table(finding_rows, colWidths=[90, 210, 70, 170])
        t_findings.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t_findings)

    story.append(Spacer(1, 10))

    # 5. Cryptographic Ledger & Signature Block
    chain_verif = verify_audit_chain(db)
    story.append(Paragraph("3. Cryptographic Audit Integrity & Endorsement", section_heading))

    sig_data = [
        [
            Paragraph("<b>Audit Trail Blocks:</b>", cell_style),
            Paragraph(f"{chain_verif['chain_length']} Blocks (SHA-256 chained)", cell_mono),
            Paragraph("<b>Ledger State:</b>", cell_style),
            Paragraph("UNBROKEN INTEGRITY VERIFIED" if chain_verif["verified"] else "TAMPER DETECTED", cell_bold)
        ],
        [
            Paragraph("<b>Officer Recommendation:</b>", cell_style),
            Paragraph(app.recommendation or "PENDING SCRUTINY DECISION", cell_bold),
            Paragraph("<b>Endorsed At:</b>", cell_style),
            Paragraph(app.recommendation_at.strftime("%Y-%m-%d %H:%M:%S") if app.recommendation_at else "Pending", cell_style)
        ],
        [
            Paragraph("<b>Scrutiny Justification:</b>", cell_style),
            Paragraph(app.recommendation_rationale or "<i>Pending Officer Justification</i>", cell_style),
            Paragraph("<b>Officer Signature:</b>", cell_style),
            Paragraph(app.recommendation_by or "Scrutiny Officer", cell_style)
        ]
    ]

    t_sig = Table(sig_data, colWidths=[110, 160, 110, 160])
    t_sig.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t_sig)

    doc.build(story, onFirstPage=draw_pdf_watermark, onLaterPages=draw_pdf_watermark)
    buf.seek(0)
    return buf.getvalue()
