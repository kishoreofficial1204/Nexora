# Nexora Architecture Specification

```
                            ┌──────────────────────────────────────────┐
                            │        Reviewer / Applicant UI           │
                            │ (Next.js 14+ App Router, TS, Tailwind)  │
                            └────────────────────┬─────────────────────┘
                                                 │ REST API / JWT RBAC
                                                 ▼
                            ┌──────────────────────────────────────────┐
                            │             FastAPI Backend              │
                            │  (Pydantic v2 Contracts, Role Guards)    │
                            └────┬────────────────────────────────┬────┘
                                 │                                │
         ┌───────────────────────┴───────────────┐                │
         ▼                                       ▼                ▼
┌───────────────────┐                 ┌──────────────────┐ ┌───────────────┐
│ Application & Doc │                 │ Verification     │ │ Regulatory    │
│ Intake Pipeline   │                 │ Subsystem        │ │ Retrieval     │
├───────────────────┤                 ├──────────────────┤ │ (RAG Engine)  │
│ • Safe Ingestion  │                 │ • Pluggable      │ ├───────────────┤
│ • SHA-256 Hashing │                 │   Connector IF   │ │ • Official    │
│ • PyMuPDF Parsing │                 │ • MockIssuer     │ │   Handbooks   │
│ • OCR Fallback    │                 │   (SIMULATED)    │ │ • Page-aware  │
│ • Field Provenance│                 │ • Audit Tracking │ │   Citations   │
└────────┬──────────┘                 └──────────────────┘ └───────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Validation & Consistency Engines                       │
├────────────────────────────────────────────────────────┤
│ • Deterministic Checklist Verification                 │
│ • Expiry & Date Ordering Check (Assessment Date)       │
│ • Cross-Document Consistency (Fuzzy/Exact Matching)    │
│ • Anomaly Signals (SHA-256 Duplicates, Perceptual Hash,│
│   PDF Incremental Updates, Visual Diffs)               │
│ • Versioned Rule Engine (YAML Packs with Provenance)   │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Data Layer & Persistence                               │
├────────────────────────────────────────────────────────┤
│ • SQLite (Demo fallback) / PostgreSQL (Deployment)     │
│ • Append-Only, Hash-Chained Audit Ledger               │
│ • Isolated Document Storage (Encrypted in Deployment)  │
└────────────────────────────────────────────────────────┘
```

## Core Principles
1. **Human-in-the-Loop Decision Support**: Findings are advisory signals, never automated rejections.
2. **Deterministic Rules before LLM**: Checklists, mathematical counts, dates, and strict constraints are evaluated by versioned Python rules.
3. **Explicit Provenance**: Every extracted field tracks `(document_id, page, bbox, raw_value, normalized_value, method, confidence)`.
4. **Append-Only Tamper-Evident Audit Trail**: Each audit log contains `prev_hash` chaining `hash(event_id + prev_hash + payload)`.
