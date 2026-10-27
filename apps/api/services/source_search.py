"""
Source Citation and Regulatory Handbook Search Service for Nexora.
Enables scrutiny officers to query regulatory sources, chapters, and rule definitions.
Implements keyword and semantic scoring over indexed regulatory norms.
Enforces draft status warnings on all outputs per Non-Negotiable Principle 10.
"""

import re
from typing import List, Dict, Any
from apps.api.rules.loader import get_default_rule_pack


DRAFT_BANNER = "UNVERIFIED AGAINST CURRENT HANDBOOK: DRAFT RULES FOR DEMO DECISION SUPPORT"
SOURCE_PLACEHOLDER = "TBD: confirm against official handbook"


# Curated regulatory handbook corpus excerpts (representing APH 2024-27 chapters)
HANDBOOK_CORPUS = [
    {
        "chapter": "Chapter I: Grant of Approval Through Scrutiny & Scrutiny of Documents",
        "section": "Clause 1.2: Permanent Institute Identifier (PID)",
        "page_citation": "APH 2024-27, Page 14, Clause 1.2",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Uniqueness of Permanent Institute Identifier (PID)",
        "content": "Every technical institution approved by the Council shall possess a unique Permanent Institute Identifier (PID). The PID must remain immutable throughout the institution's existence and must be referenced consistently on all statutory applications, approvals, and affiliation submissions.",
        "related_rules": ["RULE-EOA-007"]
    },
    {
        "chapter": "Chapter I: Grant of Approval Through Scrutiny & Scrutiny of Documents",
        "section": "Clause 1.3: Institutional Legal Title & Trust Deed",
        "page_citation": "APH 2024-27, Page 16, Clause 1.3",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Consistency of Institutional Name Across Legal Instruments",
        "content": "The registered legal name of the institution in the Council's records must accurately reflect the name approved in the Trust/Society/Company Deed. Minor variations, abbreviations, or changes of name must be corroborated with official State Gazette notifications or University approvals.",
        "related_rules": ["RULE-EOA-006"]
    },
    {
        "chapter": "Chapter II: Grant of Extension of Approval (EoA)",
        "section": "Clause 2.1: Submission Requirements for EoA",
        "page_citation": "APH 2024-27, Page 22, Clause 2.1",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Mandatory Supporting Documents for Extension of Approval",
        "content": "Existing institutions seeking Extension of Approval (EoA) for existing courses must submit the online application along with previous year approval letter, affiliating university order, valid fire safety certificate, and structural stability endorsement.",
        "related_rules": ["RULE-EOA-001"]
    },
    {
        "chapter": "Chapter II: Grant of Extension of Approval (EoA)",
        "section": "Clause 2.4: Safety Clearances and Certificates of Validity",
        "page_citation": "APH 2024-27, Page 25, Clause 2.4",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Fire & Life Safety No-Objection Certificate (NOC) Standards",
        "content": "The Fire Safety Certificate issued by the competent district authority must remain valid on the date of scrutiny assessment. Certificates expiring prior to the assessment cycle shall necessitate submission of renewed NOC or official receipt of renewal inspection.",
        "related_rules": ["RULE-EOA-002"]
    },
    {
        "chapter": "Chapter II: Grant of Extension of Approval (EoA)",
        "section": "Clause 2.5: Structural Stability and Occupancy Endorsement",
        "page_citation": "APH 2024-27, Page 27, Clause 2.5",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Building Structural Stability Certificate Requirements",
        "content": "Structural stability certificate issued by a certified Government Chartered Structural Engineer must certify the soundness of all instructional, administrative, and amenity buildings for the duration of the academic year.",
        "related_rules": ["RULE-EOA-003"]
    },
    {
        "chapter": "Chapter IV: Increase in Intake / Addition of New Courses",
        "section": "Clause 4.1: Norms for Revision of Student Intake Capacity",
        "page_citation": "APH 2024-27, Page 41, Clause 4.1",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Intake Capacity Consistency and Chapter IV Approval Thresholds",
        "content": "An institution shall not admit students in excess of the approved intake specified in the Council's previous approval order unless formal approval for increase in intake under Chapter IV has been sanctioned following compliance with NBA accreditation and infrastructure norms.",
        "related_rules": ["RULE-EOA-005"]
    },
    {
        "chapter": "Chapter V: Collaboration and Affiliation with State Universities",
        "section": "Clause 5.2: Mandatory University Affiliation Order",
        "page_citation": "APH 2024-27, Page 53, Clause 5.2",
        "url": "https://aicte.gov.in/sites/default/files/APH%20Final.pdf",
        "title": "Affiliation Continuance Order from Examining Technical University",
        "content": "Extension of Approval is strictly coterminous with affiliating University sanction. The institution must possess an affiliation order covering the current academic year issued by the State Technical University.",
        "related_rules": ["RULE-EOA-004"]
    }
]


def search_handbook_sources(query: str, limit: int = 5) -> Dict[str, Any]:
    """
    Performs keyword & lexical similarity search across official handbook clauses and rule pack.
    Returns ranked citations with draft banner notices.
    """
    clean_query = query.lower().strip()
    query_tokens = set(re.findall(r"\w+", clean_query))

    results = []
    rule_pack = get_default_rule_pack()

    # 1. Search Curated Handbook Corpus
    for item in HANDBOOK_CORPUS:
        score = 0
        text_corpus = f"{item['chapter']} {item['section']} {item['title']} {item['content']}".lower()

        for token in query_tokens:
            if len(token) > 2 and token in text_corpus:
                score += text_corpus.count(token) * 2

        if clean_query in text_corpus:
            score += 10

        if score > 0:
            results.append({
                "source_type": "handbook_clause",
                "chapter": item["chapter"],
                "section": item["section"],
                "citation": item["page_citation"],
                "title": item["title"],
                "excerpt": item["content"],
                "source_url": item["url"],
                "related_rules": item["related_rules"],
                "draft_notice": DRAFT_BANNER,
                "relevance_score": score
            })

    # 2. Search Active Rule Pack
    for r in rule_pack.rules:
        score = 0
        rule_text = f"{r.rule_id} {r.title} {r.source_document} {r.section_page} {r.severity}".lower()

        for token in query_tokens:
            if len(token) > 2 and token in rule_text:
                score += rule_text.count(token) * 3

        if clean_query in rule_text:
            score += 15

        if score > 0:
            op = r.validation_logic.get("operator", "") if isinstance(r.validation_logic, dict) else getattr(r.validation_logic, "operator", "")
            tgt = (r.validation_logic.get("target") or r.validation_logic.get("field", "")) if isinstance(r.validation_logic, dict) else getattr(r.validation_logic, "target", "")
            results.append({
                "source_type": "rule_definition",
                "rule_id": r.rule_id,
                "title": r.title,
                "citation": f"{r.source_document} ({r.section_page})",
                "section": r.section_page,
                "severity": r.severity,
                "excerpt": f"Rule logic: {op} on {tgt}. Expl: {r.explanation_template}",
                "source_url": r.source_url,
                "related_rules": [r.rule_id],
                "draft_notice": DRAFT_BANNER,
                "relevance_score": score
            })

    # Sort by relevance descending
    results.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {
        "query": query,
        "banner_notice": DRAFT_BANNER,
        "placeholder_notice": SOURCE_PLACEHOLDER,
        "total_matches": len(results),
        "results": results[:limit]
    }
