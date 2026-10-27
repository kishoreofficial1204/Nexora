"""
Simulated External Registry Connector for VeriScope.
Implements MockIssuerConnector for querying third-party institutional and municipal databases:
1. AICTE Central Institutional Portal (PID, historic approvals)
2. State Technical University Registry (Affiliation Orders)
3. State Fire & Rescue Services NOC Registry (Fire Certificates)
4. Municipal Corporation Building Authority (Structural Stability Certificates)

STRICT COMPLIANCE:
All outputs are prominently labeled "SIMULATED EXTERNAL ISSUER - DEMO ONLY" per Non-Negotiable Principle 4.
Fails closed on timeout or service disruption per Non-Negotiable Principle 3.
"""

import time
from typing import Dict, Any, Optional
from datetime import datetime


SIMULATED_BANNER = "SIMULATED EXTERNAL ISSUER - DEMO ONLY"


class MockIssuerConnector:
    """
    Simulates external API queries to official licensing and statutory issuers.
    Supports controlled simulation modes: match, mismatch, not_found, timeout, service_down.
    """

    SUPPORTED_AUTHORITIES = {
        "aicte_portal": "AICTE Central Institutional Registry",
        "state_university": "Affiliating State Technical University Registry",
        "fire_department": "State Fire & Rescue Services Licensing Portal",
        "municipal_corporation": "Municipal Corporation Structural Safety Cell"
    }

    @classmethod
    def query_registry(
        cls,
        authority_id: str,
        query_payload: Dict[str, Any],
        mode: str = "match",
        simulated_delay_ms: int = 120
    ) -> Dict[str, Any]:
        """
        Executes a simulated query to an external authority registry.
        """
        authority_name = cls.SUPPORTED_AUTHORITIES.get(authority_id, "Unknown External Authority")
        start_time = time.time()

        # Handle simulation modes
        if mode == "timeout":
            time.sleep(min(simulated_delay_ms / 1000.0, 0.5))
            latency = int((time.time() - start_time) * 1000)
            return {
                "authority_id": authority_id,
                "authority_name": authority_name,
                "status": "timeout",
                "badge": SIMULATED_BANNER,
                "latency_ms": latency + 5000,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "query_sent": query_payload,
                "response_payload": None,
                "error_message": "Gateway timeout (504): External registry failed to respond within threshold.",
                "note": "SIMULATED: Network timeout induced for stress testing fallback handling."
            }

        if mode == "service_down":
            time.sleep(min(simulated_delay_ms / 1000.0, 0.2))
            latency = int((time.time() - start_time) * 1000)
            return {
                "authority_id": authority_id,
                "authority_name": authority_name,
                "status": "service_down",
                "badge": SIMULATED_BANNER,
                "latency_ms": latency,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "query_sent": query_payload,
                "response_payload": None,
                "error_message": "Service unavailable (503): External authority endpoint undergoing scheduled maintenance.",
                "note": "SIMULATED: 503 Service Unavailable response simulated for fail-closed verification."
            }

        if mode == "not_found":
            time.sleep(min(simulated_delay_ms / 1000.0, 0.2))
            latency = int((time.time() - start_time) * 1000)
            return {
                "authority_id": authority_id,
                "authority_name": authority_name,
                "status": "not_found",
                "badge": SIMULATED_BANNER,
                "latency_ms": latency,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "query_sent": query_payload,
                "response_payload": {
                    "registry_status": "RECORD_NOT_FOUND",
                    "search_keys": query_payload
                },
                "error_message": "No matching record found in official registry database.",
                "note": "SIMULATED: Negative registry lookup simulated."
            }

        if mode == "expired":
            time.sleep(min(simulated_delay_ms / 1000.0, 0.2))
            latency = int((time.time() - start_time) * 1000)
            return {
                "authority_id": authority_id,
                "authority_name": authority_name,
                "status": "expired",
                "badge": SIMULATED_BANNER,
                "latency_ms": latency,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "query_sent": query_payload,
                "response_payload": {
                    "registry_status": "EXPIRED",
                    "expiry_date_on_file": "2026-03-31",
                    "query_claimed_expiry": query_payload.get("valid_until_date"),
                    "discrepancy": "Issuer master record shows this credential is expired.",
                },
                "error_message": "Credential is expired in the issuer master record.",
                "note": "SIMULATED: Expired credential response simulated for verification workflows.",
            }

        if mode == "mismatch":
            time.sleep(min(simulated_delay_ms / 1000.0, 0.2))
            latency = int((time.time() - start_time) * 1000)

            # Generate realistic contradictory registry record
            mismatch_data = {}
            if authority_id == "aicte_portal":
                mismatch_data = {
                    "registry_pid": query_payload.get("institute_pid", "1-9876543210"),
                    "registered_name": "ABC Institute of Technology",
                    "approved_intake": 60,
                    "query_declared_intake": query_payload.get("intake_capacity", 120),
                    "discrepancy": "Declared application intake exceeds statutory portal approved quota."
                }
            elif authority_id == "fire_department":
                mismatch_data = {
                    "noc_number": query_payload.get("certificate_number", "FS/2026/8891"),
                    "expiry_date_on_file": "2026-03-31",
                    "query_claimed_expiry": query_payload.get("valid_until_date", "2027-01-09"),
                    "discrepancy": "Department master record indicates NOC lapsed on 2026-03-31; renewal pending."
                }
            else:
                mismatch_data = {
                    "record_id": query_payload.get("certificate_number", "REG-9912"),
                    "registered_institution": "Alternative Trust / Sub-campus",
                    "discrepancy": "Institutional title in municipal database does not match applicant PID."
                }

            return {
                "authority_id": authority_id,
                "authority_name": authority_name,
                "status": "mismatch",
                "badge": SIMULATED_BANNER,
                "latency_ms": latency,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "query_sent": query_payload,
                "response_payload": mismatch_data,
                "error_message": "Registry master record contradicts submitted document attributes.",
                "note": "SIMULATED: Contradiction simulated to demonstrate reviewer alert handling."
            }

        # Default: "match" (Successful simulated verification)
        time.sleep(min(simulated_delay_ms / 1000.0, 0.2))
        latency = int((time.time() - start_time) * 1000)

        match_data = {
            "verification_token": f"SIM-VERIF-{authority_id.upper()}-{int(time.time())}",
            "registry_status": "ACTIVE_AND_VALID",
            "matched_institution_pid": query_payload.get("institute_pid", "1-9876543210"),
            "matched_institution_name": query_payload.get("institution_name", "ABC Institute of Technology"),
            "official_endorsement_date": "2026-04-01",
            "statutory_compliance_status": "COMPLIANT"
        }

        if authority_id == "fire_department":
            match_data.update({
                "noc_number": query_payload.get("certificate_number", "FS/2026/8891"),
                "valid_until": "2027-01-09",
                "issuing_authority": "Office of the Divisional Fire Officer",
                "inspection_date": "2026-01-05"
            })
        elif authority_id == "state_university":
            match_data.update({
                "affiliation_order_no": query_payload.get("order_number", "AUT/AFFIL/2026-27/4491"),
                "academic_year": "2026-27",
                "programmes_approved": ["Computer Science & Engineering", "Mechanical Engineering"]
            })

        return {
            "authority_id": authority_id,
            "authority_name": authority_name,
            "status": "verified",
            "badge": SIMULATED_BANNER,
            "latency_ms": latency,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "query_sent": query_payload,
            "response_payload": match_data,
            "error_message": None,
            "note": "SIMULATED: Synthetic registry response confirming matching credential."
        }
