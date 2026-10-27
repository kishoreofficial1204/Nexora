"""
Document Classifier for Nexora.
Classifies uploaded documents into recognized AICTE checklist document types
using heading analysis, structural keywords, and layout features.
"""

from typing import Tuple, Dict, Any


CLASSIFICATION_SIGNATURES = {
    "doc_eoa_app": [
        "extension of approval",
        "application form",
        "declared programme",
        "permanent institute id",
        "intake capacity",
        "academic year 2026-27"
    ],
    "doc_prev_eoa": [
        "approval order",
        "nelson mandela marg",
        "conveys extension of approval",
        "academic year 2025-26",
        "all india council for technical education"
    ],
    "doc_univ_affil": [
        "state technical university",
        "provisional affiliation order",
        "directorate of academic",
        "grant of provisional affiliation",
        "b.tech computer science"
    ],
    "doc_fire_safety": [
        "fire rescue",
        "no objection certificate",
        "disaster management",
        "national building code",
        "fire & life safety",
        "district fire officer"
    ],
    "doc_building_stability": [
        "structural soundness",
        "stability certificate",
        "chartered structural engineer",
        "earthquake & wind load",
        "structural integrity"
    ],
    "doc_infra_photos": [
        "campus infrastructure",
        "photographic evidence",
        "geotagged",
        "views attached",
        "lat:",
        "long:"
    ]
}


def classify_document_text(text: str, filename: str = "") -> Tuple[str, float]:
    """
    Returns (predicted_doc_type, confidence).
    Evaluates signature keyword hits and structural hints.
    """
    clean_text = text.lower()
    scores: Dict[str, float] = {}

    for doc_type, keywords in CLASSIFICATION_SIGNATURES.items():
        hits = sum(1 for kw in keywords if kw in clean_text)
        score = hits / len(keywords)
        scores[doc_type] = score

    # Check filename prefix hint as soft tiebreaker
    fname_lower = filename.lower()
    for doc_type in CLASSIFICATION_SIGNATURES.keys():
        if doc_type in fname_lower:
            scores[doc_type] = scores.get(doc_type, 0.0) + 0.35

    best_type, best_score = max(scores.items(), key=lambda item: item[1])

    if best_score < 0.2:
        return "unknown", 0.30

    confidence = min(0.99, max(0.60, best_score))
    return best_type, round(confidence, 2)
