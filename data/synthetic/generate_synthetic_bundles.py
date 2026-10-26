"""
Synthetic Document Generator for SIH26261 VeriScope.
Generates reproducible test bundles with watermarked synthetic PDFs/images
strictly complying with the Non-Negotiable Principles (Section 1).
"""

import os
import shutil
import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLES_OUTPUT_DIR = os.path.join(BASE_DIR, "bundles")
WATERMARK_TEXT = "SAMPLE: NOT AN OFFICIAL DOCUMENT"


def draw_watermark(c: canvas.Canvas, width: float, height: float):
    """Draws a prominent grey diagonal watermark across the canvas."""
    c.saveState()
    c.setFont("Helvetica-Bold", 32)
    c.setFillColor(colors.HexColor("#CBD5E1"), alpha=0.35)
    c.translate(width / 2.0, height / 2.0)
    c.rotate(42)
    c.drawCentredString(0, 0, WATERMARK_TEXT)
    c.restoreState()


def create_eoa_app_pdf(file_path: str, intake: int = 60, institution_name: str = "ABC Institute of Technology"):
    """Generates synthetic Application Form for Extension of Approval."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    # Header
    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 54, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)")
    c.setFont("Helvetica", 11)
    c.drawString(54, height - 74, "Extension of Approval (EoA) Application Form - AY 2026-27")
    c.setLineWidth(1)
    c.setStrokeColor(colors.HexColor("#94A3B8"))
    c.line(54, height - 84, width - 54, height - 84)

    # Key Value pairs
    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 120, "Permanent Institute ID:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 120, "1-9876543210")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 145, "Institution Name:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 145, institution_name)

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 170, "Application Category:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 170, "Extension of Approval (EoA)")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 195, "Academic Year:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 195, "2026-27")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 220, "Application Date:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 220, "2026-09-15")

    # Table of Courses & Intake
    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, height - 260, "Declared Programme & Approved Intake Capacity:")
    
    # Draw table outline
    table_top = height - 275
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.rect(54, table_top - 20, width - 108, 20, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(60, table_top - 14, "Programme")
    c.drawString(160, table_top - 14, "Course")
    c.drawString(320, table_top - 14, "Level")
    c.drawString(420, table_top - 14, "Intake Capacity")

    c.setFont("Helvetica", 9)
    c.drawString(60, table_top - 38, "Engineering & Tech")
    c.drawString(160, table_top - 38, "Computer Science & Engineering")
    c.drawString(320, table_top - 38, "Undergraduate")
    c.drawString(440, table_top - 38, str(intake))

    c.setLineWidth(0.5)
    c.rect(54, table_top - 46, width - 108, 46, fill=0, stroke=1)

    c.setFont("Helvetica-Oblique", 8)
    c.drawString(54, 54, "Synthetic test artifact generated for SIH26261 prototype verification. Not valid for official submission.")
    c.save()


def create_prev_eoa_pdf(file_path: str, approved_intake: int = 60):
    """Generates synthetic Previous Academic Year AICTE Approval Letter."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    c.setFont("Helvetica-Bold", 13)
    c.drawString(54, height - 54, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 72, "Nelson Mandela Marg, Vasant Kunj, New Delhi-110070")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, height - 92, "APPROVAL ORDER - EXTENSION OF APPROVAL (AY 2025-26)")
    c.setLineWidth(1)
    c.line(54, height - 100, width - 54, height - 100)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 120, "Order No: AICTE/ERO/2025-26/1-9876543210/EOA")
    c.drawString(420, height - 120, "Date: 2025-05-20")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 150, "To The Principal / Director,")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 165, "ABC Institute of Technology, Knowledge Park, Pin: 600001")
    c.drawString(54, height - 180, "AICTE Permanent Institute ID: 1-9876543210")

    c.setFont("Helvetica", 9)
    text = (
        "In terms of the provisions under the All India Council for Technical Education "
        "(Grant of Approvals for Technical Institutions) Regulations, the Council hereby conveys extension "
        "of approval to ABC Institute of Technology for the Academic Year 2025-26 as per details given below:"
    )
    p = c.beginPath()
    c.drawString(54, height - 215, text[:98])
    c.drawString(54, height - 230, text[98:])

    # Table
    table_top = height - 260
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.rect(54, table_top - 20, width - 108, 20, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(60, table_top - 14, "Programme")
    c.drawString(160, table_top - 14, "Course")
    c.drawString(320, table_top - 14, "Affiliating Body")
    c.drawString(430, table_top - 14, "Approved Intake")

    c.setFont("Helvetica", 9)
    c.drawString(60, table_top - 38, "Engineering & Tech")
    c.drawString(160, table_top - 38, "Computer Science & Engineering")
    c.drawString(320, table_top - 38, "State Tech University")
    c.drawString(450, table_top - 38, str(approved_intake))

    c.setLineWidth(0.5)
    c.rect(54, table_top - 46, width - 108, 46, fill=0, stroke=1)

    c.save()


def create_univ_affil_pdf(file_path: str, institution_name: str = "ABC Institute of Technology"):
    """Generates synthetic University Affiliation Letter."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 54, "STATE TECHNICAL UNIVERSITY")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 72, "Directorate of Academic Courses & Affiliation")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, height - 92, "PROVISIONAL AFFILIATION ORDER FOR ACADEMIC YEAR 2026-27")
    c.setLineWidth(1)
    c.line(54, height - 100, width - 54, height - 100)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 120, "Ref: STU/AFFIL/2026-27/0891")
    c.drawString(420, height - 120, "Date: 2026-06-10")

    c.setFont("Helvetica", 10)
    c.drawString(54, height - 150, "Sub: Grant of Provisional Affiliation for the Academic Year 2026-27 - Reg.")
    c.drawString(54, height - 175, f"Institution: {institution_name}")
    c.drawString(54, height - 195, "Affiliation Academic Year: 2026-27")
    c.drawString(54, height - 215, "Sanctioned Courses: B.Tech Computer Science & Engineering (Intake: 60)")

    c.drawString(54, height - 250, "This order is subject to adherence to AICTE Approval Process Handbook norms.")
    c.save()


def create_fire_safety_pdf(file_path: str, valid_until: str = "2027-01-09", issue_date: str = "2026-01-10"):
    """Generates synthetic Fire Safety Certificate (NOC)."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 54, "STATE DISASTER MANAGEMENT & FIRE RESCUE SERVICES")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 72, "Office of the District Fire Officer")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, height - 92, "NO OBJECTION CERTIFICATE (FIRE & LIFE SAFETY)")
    c.setLineWidth(1)
    c.line(54, height - 100, width - 54, height - 100)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 120, "Certificate No: FS-2026-7890")
    c.drawString(420, height - 120, f"Issue Date: {issue_date}")

    c.setFont("Helvetica", 10)
    c.drawString(54, height - 150, "Issued To:")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(130, height - 150, "ABC Institute of Technology")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 175, "Premises:")
    c.drawString(130, height - 175, "Survey No. 42/1, Knowledge Park Campus")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 210, "Validity Expiry Date:")
    c.setFont("Helvetica", 10)
    c.drawString(220, height - 210, valid_until)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 245, "Certified that fire fighting installations meet National Building Code Part IV standards.")
    c.save()


def create_building_stability_pdf(file_path: str, valid_until: str = "2029-02-14"):
    """Generates synthetic Building Structural Stability Certificate."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 54, "STRUCTURAL INTEGRITY & CIVIL CONSULTING ENGINEERS")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 72, "Chartered Structural Engineer Panel (Regn No: SE-IN-4458)")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(54, height - 92, "BUILDING STRUCTURAL SOUNDNESS & STABILITY CERTIFICATE")
    c.setLineWidth(1)
    c.line(54, height - 100, width - 54, height - 100)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 120, "Ref: BSE/2026/02-44")
    c.drawString(420, height - 120, "Issue Date: 2026-02-15")

    c.setFont("Helvetica", 10)
    c.drawString(54, height - 150, "Certified Institution:")
    c.drawString(200, height - 150, "ABC Institute of Technology")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, height - 180, "Valid Until Date:")
    c.setFont("Helvetica", 10)
    c.drawString(200, height - 180, valid_until)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 215, "The main academic and laboratory blocks are designed and constructed in compliance")
    c.drawString(54, height - 230, "with Indian Standard Earthquake & Wind Load specifications (IS 456 & IS 1893).")
    c.save()


def create_infra_photos_pdf(file_path: str, photo_count: int = 4):
    """Generates synthetic Infrastructure Photo bundle."""
    c = canvas.Canvas(file_path, pagesize=letter)
    width, height = letter

    draw_watermark(c, width, height)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(54, height - 54, "ABC INSTITUTE OF TECHNOLOGY")
    c.setFont("Helvetica", 10)
    c.drawString(54, height - 72, "Mandatory Geotagged Campus Infrastructure Photographic Evidence")
    c.setLineWidth(1)
    c.line(54, height - 82, width - 54, height - 82)

    c.setFont("Helvetica", 9)
    c.drawString(54, height - 100, f"Total Photographic Views Attached: {photo_count}")

    # Draw boxes simulating geotagged photo inserts
    box_w = 220
    box_h = 130
    coords = [
        (54, height - 250, "View 1: Main Academic Entrance & Ramps"),
        (300, height - 250, "View 2: Computer Science Laboratory"),
        (54, height - 410, "View 3: Smart Classroom Block A"),
        (300, height - 410, "View 4: Central Reading Room Library")
    ]

    for i in range(min(photo_count, len(coords))):
        x, y, label = coords[i]
        c.setFillColor(colors.HexColor("#E2E8F0"))
        c.rect(x, y, box_w, box_h, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#475569"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + 10, y + 10, label)
        c.setFont("Helvetica", 7)
        c.drawString(x + 10, y + box_h - 15, "LAT: 12.9716° N  LONG: 80.0431° E  GEO-ACC: 3.2m")

    c.save()


def create_modified_incremental_pdf(source_pdf: str, output_pdf: str):
    """
    Creates an authentically altered PDF via PyMuPDF incremental updates.
    Simulates a tamper signal where text was modified and saved incrementally.
    """
    shutil.copy(source_pdf, output_pdf)
    doc = fitz.open(output_pdf)
    page = doc[0]
    # Overlay an altered intake text annotation / modification
    page.insert_text(
        fitz.Point(440, 310), 
        " (REVISED: 120)", 
        fontsize=9, 
        color=(0.8, 0.1, 0.1)
    )
    # Save incrementally in-place to append an incremental xref update table
    doc.save(output_pdf, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
    doc.close()


def create_raster_scan_pdf(source_pdf: str, output_pdf: str):
    """
    Converts a crisp vector PDF into a low-resolution rasterized scan with slight rotation
    to simulate OCR stress cases.
    """
    doc = fitz.open(source_pdf)
    page = doc[0]
    pix = page.get_pixmap(dpi=90)  # low resolution
    img_path = output_pdf.replace(".pdf", "_temp.png")
    pix.save(img_path)
    doc.close()

    # Open image with PIL, add slight rotation (0.8 deg) and slight blur
    pil_img = Image.open(img_path)
    pil_img = pil_img.rotate(0.9, resample=Image.BICUBIC, expand=False, fillcolor="white")
    pil_img = pil_img.filter(ImageFilter.GaussianBlur(radius=0.4))
    pil_img.save(img_path)

    # Convert back to PDF
    img_doc = fitz.open()
    rect = fitz.Rect(0, 0, letter[0], letter[1])
    img_page = img_doc.new_page(width=letter[0], height=letter[1])
    img_page.insert_image(rect, filename=img_path)
    img_doc.save(output_pdf)
    img_doc.close()

    if os.path.exists(img_path):
        os.remove(img_path)


def generate_all_bundles():
    os.makedirs(BUNDLES_OUTPUT_DIR, exist_ok=True)

    # Temporary shared source directory
    shared_dir = os.path.join(BUNDLES_OUTPUT_DIR, "_shared")
    os.makedirs(shared_dir, exist_ok=True)

    # Base canonical PDFs
    create_eoa_app_pdf(os.path.join(shared_dir, "doc_eoa_app.pdf"), intake=60)
    create_prev_eoa_pdf(os.path.join(shared_dir, "doc_prev_eoa.pdf"), approved_intake=60)
    create_prev_eoa_pdf(os.path.join(shared_dir, "doc_prev_eoa_120.pdf"), approved_intake=120)
    create_univ_affil_pdf(os.path.join(shared_dir, "doc_univ_affil.pdf"))
    create_univ_affil_pdf(os.path.join(shared_dir, "doc_univ_affil_abbrev.pdf"), institution_name="A.B.C. Inst. of Tech.")
    create_fire_safety_pdf(os.path.join(shared_dir, "doc_fire_safety.pdf"), valid_until="2027-01-09")
    create_fire_safety_pdf(os.path.join(shared_dir, "doc_fire_safety_expired.pdf"), valid_until="2026-03-31", issue_date="2025-04-01")
    create_building_stability_pdf(os.path.join(shared_dir, "doc_building_stability.pdf"), valid_until="2029-02-14")
    create_infra_photos_pdf(os.path.join(shared_dir, "doc_infra_photos.pdf"), photo_count=4)

    # Build Bundle A: Clean
    bundle_a = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_a_clean")
    os.makedirs(bundle_a, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_univ_affil.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_a, fname))

    # Build Bundle B: Missing Affiliation Document
    bundle_b = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_b_missing_doc")
    os.makedirs(bundle_b, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_b, fname))

    # Build Bundle C: Expired Certificate
    bundle_c = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_c_expired_cert")
    os.makedirs(bundle_c, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_univ_affil.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_c, fname))
    shutil.copy(os.path.join(shared_dir, "doc_fire_safety_expired.pdf"), os.path.join(bundle_c, "doc_fire_safety_expired.pdf"))

    # Build Bundle D: Intake Mismatch (Application 60 vs Approval Letter 120)
    bundle_d = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_d_intake_mismatch")
    os.makedirs(bundle_d, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_univ_affil.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_d, fname))
    shutil.copy(os.path.join(shared_dir, "doc_prev_eoa_120.pdf"), os.path.join(bundle_d, "doc_prev_eoa_120.pdf"))

    # Build Bundle E: Exact Duplicate (fire safety duplicated as building stability)
    bundle_e = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_e_exact_duplicate")
    os.makedirs(bundle_e, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_univ_affil.pdf", "doc_fire_safety.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_e, fname))
    # Duplicate file with exact same content & SHA-256
    shutil.copy(os.path.join(shared_dir, "doc_fire_safety.pdf"), os.path.join(bundle_e, "doc_building_stability_duplicate.pdf"))

    # Build Bundle F: Near Duplicate / Rescanned Document
    bundle_f = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_f_near_duplicate")
    os.makedirs(bundle_f, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_univ_affil.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_f, fname))
    # Generate near-duplicate of fire safety
    create_raster_scan_pdf(
        os.path.join(shared_dir, "doc_fire_safety.pdf"),
        os.path.join(bundle_f, "doc_fire_safety_rescanned.pdf")
    )

    # Build Bundle G: Modified PDF (Incremental Update)
    bundle_g = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_g_modified_pdf")
    os.makedirs(bundle_g, exist_ok=True)
    for fname in ["doc_prev_eoa.pdf", "doc_univ_affil.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_g, fname))
    create_modified_incremental_pdf(
        os.path.join(shared_dir, "doc_eoa_app.pdf"),
        os.path.join(bundle_g, "doc_eoa_app_tampered.pdf")
    )

    # Build Bundle H: Low Quality Scan (OCR Stress)
    bundle_h = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_h_low_quality_ocr")
    os.makedirs(bundle_h, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_h, fname))
    create_raster_scan_pdf(
        os.path.join(shared_dir, "doc_univ_affil.pdf"),
        os.path.join(bundle_h, "doc_univ_affil_raster_scan.pdf")
    )

    # Build Bundle I: Name Variant ("A.B.C. Inst. of Tech.")
    bundle_i = os.path.join(BUNDLES_OUTPUT_DIR, "bundle_i_name_variant")
    os.makedirs(bundle_i, exist_ok=True)
    for fname in ["doc_eoa_app.pdf", "doc_prev_eoa.pdf", "doc_fire_safety.pdf", "doc_building_stability.pdf", "doc_infra_photos.pdf"]:
        shutil.copy(os.path.join(shared_dir, fname), os.path.join(bundle_i, fname))
    shutil.copy(os.path.join(shared_dir, "doc_univ_affil_abbrev.pdf"), os.path.join(bundle_i, "doc_univ_affil_abbrev.pdf"))

    # Cleanup temporary shared folder
    shutil.rmtree(shared_dir)
    print(f"[SUCCESS] Generated 9 synthetic test bundles in {BUNDLES_OUTPUT_DIR}")


if __name__ == "__main__":
    generate_all_bundles()
