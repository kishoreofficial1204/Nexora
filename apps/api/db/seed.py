"""
Database Seeding Script for VeriScope.
Initializes tables, creates demo role accounts, provisions the synthetic institution,
and seeds initial demonstration cases.
"""

import os
import sys

# Ensure project root in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from apps.api.db.database import Base, engine, SessionLocal
from apps.api.models import User, UserRole, Institution
from apps.api.core.security import get_password_hash


def seed_database():
    print("[INIT] Creating database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed Demo Users for all 5 RBAC roles
        demo_users = [
            {
                "email": "reviewer@aicte-demo.in",
                "full_name": "Dr. R. K. Sharma (Scrutiny Officer)",
                "role": UserRole.REVIEWER,
                "organization": "AICTE Scrutiny Cell, Northern Region"
            },
            {
                "email": "senior_reviewer@aicte-demo.in",
                "full_name": "Prof. Ananya Sen (Senior Reviewer & Approver)",
                "role": UserRole.SENIOR_REVIEWER,
                "organization": "AICTE Approval Bureau, New Delhi"
            },
            {
                "email": "admin@aicte-demo.in",
                "full_name": "P. Venkatesh (System & Rules Admin)",
                "role": UserRole.ADMIN,
                "organization": "AICTE IT & Policy Directorate"
            },
            {
                "email": "auditor@aicte-demo.in",
                "full_name": "S. Mukherjee (Statutory Compliance Auditor)",
                "role": UserRole.AUDITOR,
                "organization": "Independent Governance Oversight"
            },
            {
                "email": "applicant@aicte-demo.in",
                "full_name": "Registrar, ABC Institute of Technology",
                "role": UserRole.APPLICANT,
                "organization": "ABC Institute of Technology"
            }
        ]

        default_password = "DemoPass123!"
        hashed_pwd = get_password_hash(default_password)

        for u_data in demo_users:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                user = User(
                    email=u_data["email"],
                    hashed_password=hashed_pwd,
                    full_name=u_data["full_name"],
                    role=u_data["role"],
                    organization=u_data["organization"],
                    is_active=True
                )
                db.add(user)
                print(f"  + Seeded user: {u_data['email']} ({u_data['role']})")
        db.commit()

        # 2. Seed Synthetic Institution
        inst = db.query(Institution).filter(Institution.permanent_id == "1-9876543210").first()
        if not inst:
            inst = Institution(
                name="ABC Institute of Technology",
                permanent_id="1-9876543210",
                address="Survey No. 42/1, Knowledge Park Campus, Chennai Road",
                state="Tamil Nadu",
                institution_type="Engineering & Technology - Undergraduate",
                profile_source="synthetic_seed"
            )
            db.add(inst)
            db.commit()
            print(f"  + Seeded institution: {inst.name} (PID: {inst.permanent_id})")

        print("[SUCCESS] Database seeded successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
