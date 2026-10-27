# Nexora Master Makefile

PYTHON ?= python
NPM ?= npm

.PHONY: help setup dev-api dev-web seed test eval clean demo

help:
	@echo "Nexora Development & Evaluation Commands:"
	@echo "  make setup     - Install Python and Node dependencies"
	@echo "  make seed      - Generate synthetic document bundles and ground truth"
	@echo "  make test      - Run automated test suite (rules, data, pipeline)"
	@echo "  make eval      - Run evaluation harness on synthetic datasets"
	@echo "  make dev-api   - Start FastAPI backend server"
	@echo "  make dev-web   - Start Next.js frontend console"
	@echo "  make demo      - Verify all datasets, rules, and run demo smoke checks"

setup:
	$(PYTHON) -m pip install -r apps/api/requirements.txt
	cd apps/web && $(NPM) install

seed:
	$(PYTHON) data/synthetic/generate_synthetic_bundles.py

test:
	$(PYTHON) -m pytest apps/api/tests -v

eval:
	$(PYTHON) eval/evaluate.py

dev-api:
	$(PYTHON) -m uvicorn apps.api.main:app --reload --port 8000

dev-web:
	cd apps/web && $(NPM) run dev

clean:
	rm -rf storage/documents/* data/synthetic/bundles/*
