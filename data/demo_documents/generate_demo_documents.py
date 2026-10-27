"""
Generate the default synthetic PDF packet used by the demo intake screen.

These documents are intentionally watermarked and contain only fictional data.
They are served from apps/web/public/demo-documents so the New Application form
can attach a complete evidence packet without asking the presenter to find files
on disk.

Run from the repository root:

    .\\.venv\\Scripts\\python.exe data\\demo_documents\\generate_demo_documents.py
"""

from __future__ import annotations

import os
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUTPUT_DIR = os.path.join(ROOT, "apps", "web", "public", "demo-documents")

PAGE_WIDTH, PAGE_HEIGHT = letter
LEFT = 54
RIGHT = PAGE_WIDTH - 54
TOP = PAGE_HEIGHT - 54
BOTTOM = 54
WATERMARK = "SAMPLE: NOT AN OFFICIAL DOCUMENT"
INSTITUTION = "ABC Institute of Technology"
PID = "1-9876543210"


def draw_watermark(c: canvas.Canvas) -> None:
    c.saveState()
    c.setFont("Helvetica-Bold", 30)
    c.setFillColor(colors.HexColor("#CBD5E1"), alpha=0.28)
    c.translate(PAGE_WIDTH / 2, PAGE_HEIGHT / 2)
    c.rotate(42)
    c.drawCentredString(0, 0, WATERMARK)
    c.restoreState()


def draw_page_frame(c: canvas.Canvas, doc_title: str, page_no: int, page_count: int) -> None:
    draw_watermark(c)
    c.setStrokeColor(colors.HexColor("#94A3B8"))
    c.setLineWidth(0.8)
    c.rect(LEFT - 10, BOTTOM - 10, RIGHT - LEFT + 20, TOP - BOTTOM + 20)

    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.HexColor("#64748B"))
    c.drawString(LEFT, PAGE_HEIGHT - 28, "SYNTHETIC DEMO ARTIFACT · NOT AN OFFICIAL RECORD")
    c.drawString(LEFT, 30, "Generated for the VeriScope SIH walkthrough · fictional institution")
    c.drawRightString(RIGHT, 30, f"{doc_title} · Page {page_no} of {page_count}")

    c.setFillColor(colors.HexColor("#0F172A"))


def text(c: canvas.Canvas, x: float, y: float, value: str, size: float = 10, bold: bool = False) -> None:
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(x, y, value)


def label_value(c: canvas.Canvas, y: float, label: str, value: str, x: float = LEFT, value_x: float | None = None) -> None:
    text(c, x, y, label, 9, bold=True)
    text(c, value_x if value_x is not None else x + 170, y, value, 9)


def section(c: canvas.Canvas, y: float, title: str) -> None:
    c.setFillColor(colors.HexColor("#E2E8F0"))
    c.rect(LEFT, y - 5, RIGHT - LEFT, 20, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0F172A"))
    text(c, LEFT + 6, y + 1, title, 9, bold=True)


def table_header(c: canvas.Canvas, y: float, columns: Iterable[tuple[str, float]]) -> None:
    c.setFillColor(colors.HexColor("#F1F5F9"))
    c.rect(LEFT, y - 4, RIGHT - LEFT, 18, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#0F172A"))
    for heading, x in columns:
        text(c, x, y, heading, 8, bold=True)


def footer_note(c: canvas.Canvas, y: float, note: str) -> None:
    text(c, LEFT, y, note, 7.5)
    c.setFont("Helvetica-Oblique", 7.5)
    c.drawString(LEFT, y - 13, "Watermarked synthetic document generated for demonstration and pipeline testing.")


def save(c: canvas.Canvas, filename: str) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, filename)
    c.save()
    print(f"  + {os.path.relpath(path, ROOT)}")


def eoa_application() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_eoa_app.pdf"), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, "EoA Application", page, 2)
        text(c, LEFT, TOP - 10, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", 13, bold=True)
        text(c, LEFT, TOP - 28, "Extension of Approval (EoA) Application Summary · AY 2026-27", 10)
        c.setStrokeColor(colors.HexColor("#94A3B8"))
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            label_value(c, TOP - 68, "Permanent Institute ID:", PID)
            label_value(c, TOP - 90, "Institution Name:", INSTITUTION)
            label_value(c, TOP - 112, "Application Category:", "Extension of Approval (EoA)")
            label_value(c, TOP - 134, "Academic Year:", "2026-27")
            label_value(c, TOP - 156, "Application Date:", "2026-09-15")

            section(c, TOP - 196, "Declared programme and intake")
            table_header(c, TOP - 216, [("Programme", LEFT + 6), ("Course", 170), ("Level", 330), ("Intake", 470)])
            text(c, LEFT + 6, TOP - 236, "Engineering & Technology", 8)
            text(c, 170, TOP - 236, "Computer Science & Engineering", 8)
            text(c, 330, TOP - 236, "Undergraduate 60", 8)
            text(c, 470, TOP - 236, "60", 8)
            c.setStrokeColor(colors.HexColor("#CBD5E1"))
            c.rect(LEFT, TOP - 245, RIGHT - LEFT, 47, fill=0, stroke=1)

            section(c, TOP - 290, "Institutional declarations")
            for idx, line in enumerate(
                [
                    "The institution confirms that the uploaded evidence matches the current portal application.",
                    "The intake declared above is the proposed intake for the 2026-27 academic year.",
                    "The institution will produce originals during physical verification, if requested.",
                ]
            ):
                text(c, LEFT, TOP - 312 - (idx * 18), f"•  {line}", 8)

            section(c, TOP - 390, "Authorised signatory")
            text(c, LEFT, TOP - 414, "Name: Dr. Meera Raman", 9)
            text(c, LEFT, TOP - 432, "Designation: Principal", 9)
            text(c, LEFT, TOP - 450, "Place: Bengaluru, Karnataka", 9)
        else:
            section(c, TOP - 68, "Submission checklist")
            rows = [
                ("Application form", "Attached"),
                ("Previous AICTE approval", "Attached"),
                ("University affiliation", "Attached"),
                ("Fire safety NOC", "Attached"),
                ("Structural stability certificate", "Attached"),
                ("Infrastructure photographs", "Attached"),
            ]
            for idx, (item, status) in enumerate(rows):
                y = TOP - 92 - (idx * 22)
                text(c, LEFT + 6, y, item, 9)
                text(c, 390, y, status, 9)

            section(c, TOP - 260, "Declaration")
            text(c, LEFT, TOP - 286, "I certify that the information furnished in this application is true and correct.", 9)
            text(c, LEFT, TOP - 304, "I understand that this synthetic document is not valid for any official purpose.", 9)
            text(c, LEFT, TOP - 342, "Signature: ______________________________", 9)
            text(c, LEFT, TOP - 366, "Date: 2026-09-15", 9)

        footer_note(c, BOTTOM + 24, "Document type: doc_eoa_app · applicant declaration and intake schedule")
        c.showPage()
    save(c, "doc_eoa_app.pdf")


def previous_eoa() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_prev_eoa.pdf"), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, "Previous Approval", page, 2)
        text(c, LEFT, TOP - 10, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", 13, bold=True)
        text(c, LEFT, TOP - 28, "Approval Order · Extension of Approval (AY 2025-26)", 10)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            label_value(c, TOP - 68, "Institution Name:", INSTITUTION)
            label_value(c, TOP - 90, "Permanent Institute ID:", PID)
            label_value(c, TOP - 112, "Order No:", "AICTE/ERO/2025-26/1-9876543210/EOA")
            label_value(c, TOP - 134, "Issue Date:", "2025-05-20")
            label_value(c, TOP - 156, "Academic Year:", "2025-26")

            section(c, TOP - 196, "Approved programme")
            table_header(c, TOP - 216, [("Programme", LEFT + 6), ("Course", 170), ("Level", 330), ("Approved Intake", 455)])
            text(c, LEFT + 6, TOP - 236, "Engineering & Technology", 8)
            text(c, 170, TOP - 236, "Computer Science & Engineering", 8)
            text(c, 330, TOP - 236, "Undergraduate", 8)
            text(c, 470, TOP - 236, "Approved Intake: 60", 8)
            c.setStrokeColor(colors.HexColor("#CBD5E1"))
            c.rect(LEFT, TOP - 245, RIGHT - LEFT, 47, fill=0, stroke=1)

            text(c, LEFT, TOP - 278, "The Council approves continuation of the existing programme with an approved intake of 60 seats.", 9)
            text(c, LEFT, TOP - 300, "This order is subject to compliance with the conditions in the approval handbook.", 9)
        else:
            section(c, TOP - 68, "Conditions of approval")
            conditions = [
                "Maintain the faculty cadre ratio prescribed for the approved programme.",
                "Keep the fire safety NOC and structural stability certificate current.",
                "Submit the affiliating university order before the start of the academic year.",
                "Provide infrastructure photographs and land records when requested.",
            ]
            for idx, condition in enumerate(conditions):
                text(c, LEFT, TOP - 94 - (idx * 26), f"{idx + 1}.  {condition}", 9)

            section(c, TOP - 230, "Issuing authority")
            text(c, LEFT, TOP - 256, "Regional Officer, AICTE Eastern Regional Office", 9)
            text(c, LEFT, TOP - 274, "Nelson Mandela Marg, Vasant Kunj, New Delhi-110070", 9)

        footer_note(c, BOTTOM + 24, "Document type: doc_prev_eoa · previous-year approval order")
        c.showPage()
    save(c, "doc_prev_eoa.pdf")


def university_affiliation() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_univ_affil.pdf"), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, "University Affiliation", page, 2)
        text(c, LEFT, TOP - 10, "STATE TECHNICAL UNIVERSITY", 13, bold=True)
        text(c, LEFT, TOP - 28, "Office of the Registrar · Affiliation Section", 9)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            label_value(c, TOP - 68, "Ref:", "STU/AFF/2026/1842")
            label_value(c, TOP - 90, "Issue Date:", "2026-06-12")
            label_value(c, TOP - 112, "Institution Name:", INSTITUTION)
            label_value(c, TOP - 134, "Affiliation Academic Year:", "2026-27")
            label_value(c, TOP - 156, "Programme:", "B.E. Computer Science & Engineering")

            section(c, TOP - 196, "Affiliation order")
            text(c, LEFT, TOP - 224, "The institution is granted provisional affiliation for the programme listed above.", 9)
            text(c, LEFT, TOP - 246, "The affiliation is valid for the 2026-27 academic year, subject to fulfilment of", 9)
            text(c, LEFT, TOP - 264, "the conditions communicated by the university inspection committee.", 9)
            text(c, LEFT, TOP - 300, "Sanctioned intake for the programme: 60 seats.", 9)
        else:
            section(c, TOP - 68, "Compliance conditions")
            for idx, line in enumerate(
                [
                    "The institution shall maintain the prescribed faculty and laboratory facilities.",
                    "Any change in programme name or intake requires prior university approval.",
                    "The institution shall submit the annual compliance report before 31 March 2027.",
                ]
            ):
                text(c, LEFT, TOP - 94 - (idx * 26), f"{idx + 1}.  {line}", 9)

            text(c, LEFT, TOP - 220, "For State Technical University", 9, bold=True)
            text(c, LEFT, TOP - 242, "Registrar", 9)
            text(c, LEFT, TOP - 260, "Date: 2026-06-12", 9)

        footer_note(c, BOTTOM + 24, "Document type: doc_univ_affil · provisional affiliation order")
        c.showPage()
    save(c, "doc_univ_affil.pdf")


def fire_safety() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_fire_safety.pdf"), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, "Fire Safety NOC", page, 2)
        text(c, LEFT, TOP - 10, "STATE FIRE AND RESCUE SERVICES", 13, bold=True)
        text(c, LEFT, TOP - 28, "No Objection Certificate · Fire Safety", 10)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            label_value(c, TOP - 68, "Certificate No:", "FSC/2026/ABC/118")
            label_value(c, TOP - 90, "Issue Date:", "2026-07-01")
            label_value(c, TOP - 112, "Institution Name:", INSTITUTION)
            label_value(c, TOP - 134, "Valid Until Date:", "2027-06-30")
            label_value(c, TOP - 156, "Premises:", "Whitefield Campus, Bengaluru")

            section(c, TOP - 196, "Certificate")
            text(c, LEFT, TOP - 224, "The premises have been inspected for fire safety and found to comply with the", 9)
            text(c, LEFT, TOP - 242, "requirements of the State Fire Safety Regulations for the period stated below.", 9)

            section(c, TOP - 286, "Validity")
            text(c, LEFT, TOP - 312, "This NOC is valid from 2026-07-01 to 2027-06-30.", 9)
            text(c, LEFT, TOP - 330, "The certificate must be renewed before the expiry date.", 9)
        else:
            section(c, TOP - 68, "Inspection notes")
            for idx, line in enumerate(
                [
                    "Fire extinguishers are installed on all floors and tagged with inspection dates.",
                    "Emergency exits and staircases are unobstructed.",
                    "The campus fire alarm and hydrant systems were tested during the inspection.",
                ]
            ):
                text(c, LEFT, TOP - 94 - (idx * 24), f"•  {line}", 9)

            text(c, LEFT, TOP - 200, "Authorised Officer: R. K. Sharma", 9)
            text(c, LEFT, TOP - 220, "Designation: Divisional Fire Officer", 9)

        footer_note(c, BOTTOM + 24, "Document type: doc_fire_safety · synthetic NOC for demo use")
        c.showPage()
    save(c, "doc_fire_safety.pdf")


def building_stability() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_building_stability.pdf"), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, "Building Stability", page, 2)
        text(c, LEFT, TOP - 10, "STRUCTURAL ENGINEERING CONSULTANCY", 13, bold=True)
        text(c, LEFT, TOP - 28, "Building Structural Stability Certificate", 10)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            label_value(c, TOP - 68, "Institution Name:", INSTITUTION)
            label_value(c, TOP - 90, "Issue Date:", "2026-04-18")
            label_value(c, TOP - 112, "Valid Until Date:", "2027-03-31")
            label_value(c, TOP - 134, "Regn No:", "CE/KA/2019/4421")
            label_value(c, TOP - 156, "Building Block:", "Academic Block A")

            section(c, TOP - 196, "Certificate")
            text(c, LEFT, TOP - 224, "The building has been inspected and found structurally stable for continued", 9)
            text(c, LEFT, TOP - 242, "educational use. The certificate is valid until 2027-03-31.", 9)
            text(c, LEFT, TOP - 272, "The owner shall obtain a fresh inspection before the validity date.", 9)

            section(c, TOP - 314, "Inspecting engineer")
            text(c, LEFT, TOP - 340, "Name: Ar. Nandini Rao", 9)
            text(c, LEFT, TOP - 358, "Registration: CE/KA/2019/4421", 9)
        else:
            section(c, TOP - 68, "Scope of inspection")
            for idx, line in enumerate(
                [
                    "Visual inspection of columns, beams, slabs, staircases, and load-bearing walls.",
                    "Review of available structural drawings and previous inspection records.",
                    "Non-destructive testing was not part of this synthetic demonstration record.",
                ]
            ):
                text(c, LEFT, TOP - 94 - (idx * 24), f"•  {line}", 9)

            text(c, LEFT, TOP - 210, "This is a fictional certificate generated for the VeriScope demo.", 9)
            text(c, LEFT, TOP - 232, "It is not issued by any government authority.", 9)

        footer_note(c, BOTTOM + 24, "Document type: doc_building_stability · synthetic structural certificate")
        c.showPage()
    save(c, "doc_building_stability.pdf")


def infrastructure_photos() -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, "doc_infra_photos.pdf"), pagesize=letter)
    captions = [
        ("Central Library", "Reading hall and digital resource centre"),
        ("Computer Centre", "120 workstations and network racks"),
        ("Electronics Laboratory", "Workbenches and measurement equipment"),
        ("Classroom Block", "Smart classrooms with projection facilities"),
        ("Workshop", "Mechanical and fabrication bays"),
        ("Sports Ground", "Outdoor play area and spectator gallery"),
    ]
    for page in (1, 2, 3):
        draw_page_frame(c, "Infrastructure Photos", page, 3)
        text(c, LEFT, TOP - 10, "GEOTAGGED INFRASTRUCTURE PHOTOGRAPHS", 13, bold=True)
        text(c, LEFT, TOP - 28, "Synthetic campus evidence bundle · ABC Institute of Technology", 9)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            text(c, LEFT, TOP - 68, "Views Attached: 6", 11, bold=True)
            text(c, LEFT, TOP - 88, "All photographs are fictional placeholders generated for the demo.", 8)

        start = (page - 1) * 2
        for idx, (title, subtitle) in enumerate(captions[start : start + 2]):
            top = TOP - 130 - (idx * 275)
            c.setFillColor(colors.HexColor("#E2E8F0"))
            c.rect(LEFT, top - 180, RIGHT - LEFT, 180, fill=1, stroke=0)
            c.setFillColor(colors.HexColor("#475569"))
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(PAGE_WIDTH / 2, top - 55, "PHOTO PLACEHOLDER")
            c.setFont("Helvetica", 9)
            c.drawCentredString(PAGE_WIDTH / 2, top - 78, title)
            text(c, LEFT, top - 200, f"View {start + idx + 1}: {title}", 9, bold=True)
            text(c, LEFT, top - 216, subtitle, 8)
            text(
                c,
                LEFT,
                top - 232,
                f"LAT: 12.97{16 + idx}  LONG: 77.59{46 + idx}  ·  Captured: 2026-08-14 10:{20 + idx}:00",
                7.5,
            )

        footer_note(c, BOTTOM + 24, "Document type: doc_infra_photos · 6 geotagged views")
        c.showPage()
    save(c, "doc_infra_photos.pdf")


def simple_document(
    filename: str,
    title: str,
    subtitle: str,
    fields: list[tuple[str, str]],
    paragraphs: list[str],
) -> None:
    c = canvas.Canvas(os.path.join(OUTPUT_DIR, filename), pagesize=letter)
    for page in (1, 2):
        draw_page_frame(c, title, page, 2)
        text(c, LEFT, TOP - 10, title.upper(), 13, bold=True)
        text(c, LEFT, TOP - 28, subtitle, 9)
        c.line(LEFT, TOP - 38, RIGHT, TOP - 38)

        if page == 1:
            for idx, (label, value) in enumerate(fields):
                label_value(c, TOP - 70 - (idx * 22), f"{label}:", value)
            section(c, TOP - 70 - (len(fields) * 22) - 26, "Record details")
            for idx, paragraph in enumerate(paragraphs):
                text(c, LEFT, TOP - 70 - (len(fields) * 22) - 52 - (idx * 20), paragraph, 9)
        else:
            section(c, TOP - 68, "Declaration")
            text(c, LEFT, TOP - 96, "This synthetic document is part of the demo evidence packet.", 9)
            text(c, LEFT, TOP - 118, "It is watermarked and is not valid for any official purpose.", 9)
            text(c, LEFT, TOP - 160, "Authorised signatory: ______________________________", 9)
            text(c, LEFT, TOP - 184, "Date: 2026-08-20", 9)

        footer_note(c, BOTTOM + 24, f"Document type: {filename.replace('.pdf', '')} · synthetic demo record")
        c.showPage()
    save(c, filename)


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("Generating default demo PDFs:")
    eoa_application()
    previous_eoa()
    university_affiliation()
    fire_safety()
    building_stability()
    infrastructure_photos()

    simple_document(
        "doc_land_documents.pdf",
        "Land and Occupancy Record",
        "Registered lease deed and revenue extract",
        [
            ("Institution Name", INSTITUTION),
            ("Permanent Institute ID", PID),
            ("Registered Lease Deed No", "BLR/LEASE/2018/4472"),
            ("Revenue Extract", "Survey No. 44/2, Whitefield"),
            ("Issue Date", "2026-05-08"),
        ],
        [
            "The institution occupies the identified land under a registered lease.",
            "The revenue extract confirms the survey number and campus address.",
            "Originals are available for inspection by the approving authority.",
        ],
    )
    simple_document(
        "doc_faculty_cadre.pdf",
        "Faculty Cadre Statement",
        "Endorsed faculty list and student-faculty ratio",
        [
            ("Institution Name", INSTITUTION),
            ("Permanent Institute ID", PID),
            ("Academic Year", "2026-27"),
            ("Sanctioned Faculty", "42"),
            ("Student-Faculty Ratio", "1:15"),
            ("Issue Date", "2026-08-20"),
        ],
        [
            "The faculty list includes 42 sanctioned positions across the approved programme.",
            "The current student-faculty ratio is maintained at 1:15.",
            "The statement is endorsed by the Principal and the Registrar.",
        ],
    )
    simple_document(
        "doc_anti_ragging.pdf",
        "Anti-Ragging Committee",
        "Constitution notification and squad details",
        [
            ("Institution Name", INSTITUTION),
            ("Permanent Institute ID", PID),
            ("Notification No", "ABC/AR/2026/07"),
            ("Issue Date", "2026-07-12"),
            ("Committee Chair", "Dr. Meera Raman"),
        ],
        [
            "An anti-ragging committee and squad have been constituted for 2026-27.",
            "The committee includes faculty, student representatives, and external members.",
            "Contact details are displayed on the institution notice board.",
        ],
    )
    simple_document(
        "doc_barrier_free.pdf",
        "Barrier-Free Environment",
        "Divyangjan facility compliance certificate",
        [
            ("Institution Name", INSTITUTION),
            ("Permanent Institute ID", PID),
            ("Certificate No", "ABC/BF/2026/11"),
            ("Issue Date", "2026-06-30"),
        ],
        [
            "Ramps and accessible restrooms are available in the academic block.",
            "The central library and computer centre have step-free access.",
            "A lift is available for access to upper floors.",
        ],
    )
    print("Done.")


if __name__ == "__main__":
    main()
