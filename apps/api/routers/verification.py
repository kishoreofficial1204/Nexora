"""
External Verification Registry Router for VeriScope.
Exposes MockIssuerConnector for simulated external registry lookups.
Every response is loudly badged 'SIMULATED EXTERNAL ISSUER - DEMO ONLY'.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Query, Body
from pydantic import BaseModel

from apps.api.services.mock_issuer import MockIssuerConnector, SIMULATED_BANNER

router = APIRouter(prefix="/api/verification", tags=["External Verification"])


class VerificationQueryRequest(BaseModel):
    authority_id: str
    query_payload: Dict[str, Any]
    mode: Optional[str] = "match"  # match, mismatch, not_found, timeout, service_down
    simulated_delay_ms: Optional[int] = 150


@router.get("/authorities")
def get_supported_authorities():
    """Lists external authorities available for registry verification."""
    return {
        "badge": SIMULATED_BANNER,
        "authorities": [
            {
                "id": k,
                "name": v,
                "type": "simulated_registry",
                "supported_modes": ["match", "mismatch", "not_found", "timeout", "service_down"]
            }
            for k, v in MockIssuerConnector.SUPPORTED_AUTHORITIES.items()
        ]
    }


@router.post("/query")
def query_external_registry(req: VerificationQueryRequest):
    """
    Executes a simulated external authority registry query.
    Always includes the SIMULATED banner per Non-Negotiable Principle 4.
    """
    result = MockIssuerConnector.query_registry(
        authority_id=req.authority_id,
        query_payload=req.query_payload,
        mode=req.mode or "match",
        simulated_delay_ms=req.simulated_delay_ms or 150
    )
    return result
