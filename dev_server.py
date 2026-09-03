"""SmartScan — Lightweight standalone dev server.

Runs the full scan pipeline WITHOUT Docker, PostgreSQL, Redis, MinIO, or Celery.
Uses SQLite for complaints, local filesystem for storage, and processes scans synchronously.
"""

import base64
import json
import os
import uuid
import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional

import sqlite3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smartscan-dev")

# ── App ──
app = FastAPI(title="SmartScan Dev Server", version="dev")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Storage: local filesystem ──
STORAGE_DIR = Path(__file__).parent / "backend" / "_dev_storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# ── SQLite for complaints ──
DB_PATH = STORAGE_DIR / "dev.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL,
            location TEXT NOT NULL,
            status TEXT DEFAULT 'OPEN',
            created_at TEXT DEFAULT (datetime('now')),
            resolved_at TEXT
        )
    """)
    conn.commit()
    return conn

# ── In-memory task store ──
tasks = {}

# ── Gemini API key ──
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_API_KEY:
    # Try reading from .env file
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                GEMINI_API_KEY = line.split("=", 1)[1].strip()
                break


def run_scan_pipeline(images_bytes: list) -> dict:
    """Run the full scan pipeline synchronously."""
    task_id = str(uuid.uuid4())
    logger.info(f"[{task_id}] Starting scan with {len(images_bytes)} images")

    # Step 1: OpenCV Analysis
    try:
        from app.cv.engine import CVEngine
        cv_engine = CVEngine()
        cv_results = cv_engine.analyze(images_bytes[0])
        logger.info(f"[{task_id}] CV analysis complete")
    except Exception as e:
        logger.warning(f"[{task_id}] CV analysis failed: {e}, using defaults")
        cv_results = {
            "curvature_warning": False,
            "font_metrics": [],
            "image_shape": [1080, 1920, 3],
        }

    # Step 2: Gemini AI Extraction
    try:
        import google.generativeai as genai

        if GEMINI_API_KEY and GEMINI_API_KEY != "YOUR_GEMINI_API_KEY_HERE":
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash-lite")

            PROMPT = """You are an expert label reader for Indian packaged commodities.
Analyze this product label image and extract the following mandatory fields
as defined by the Legal Metrology (Packaged Commodities) Rules, 2011.

Return a JSON object with these keys (use null if not found):
{
  "product_name": "Name of the commodity",
  "manufacturer_name": "Name and address of the manufacturer/packer/importer",
  "manufacturer_address": "Full address",
  "country_of_origin": "Country of origin (for imported goods)",
  "net_quantity": "Net quantity (with unit, e.g., '500 g', '1 L')",
  "net_quantity_unit": "Unit of measurement (g, kg, mL, L, etc.)",
  "mrp": "Maximum Retail Price (inclusive of all taxes)",
  "mrp_currency": "Currency symbol or code",
  "manufacture_date": "Date of manufacture (any format found)",
  "expiry_date": "Best before / expiry date",
  "batch_number": "Batch or lot number",
  "customer_care": "Consumer care details (phone, email, address)",
  "ingredients": "List of ingredients if applicable",
  "nutritional_info": "Nutritional information if visible",
  "allergen_info": "Allergen declarations if present",
  "veg_nonveg_symbol": "Vegetarian/Non-vegetarian symbol (green/brown dot)",
  "fssai_license": "FSSAI license number if visible",
  "barcode_visible": true or false,
  "other_declarations": ["Any other mandatory declarations found"],
  "gemini_verdict": "PASS or FAIL or WARNING",
  "gemini_compliance_reasoning": "Write a 2-3 sentence explanation directly judging compliance with Indian Legal Metrology Rules, 2011, based on the fields you found."
}

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.
If a field is partially visible or unclear, provide your best reading and
add a key "uncertain_fields" listing those field names."""

            parts = [PROMPT]
            for img_bytes in images_bytes:
                parts.append({
                    "mime_type": "image/jpeg",
                    "data": img_bytes,
                })

            response = model.generate_content(
                parts,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=8192,
                ),
            )

            raw_text = response.text.strip()
            import re
            match = re.search(r"```(?:json)?\s*\n(.*?)\n```", raw_text, re.DOTALL)
            if match:
                raw_text = match.group(1).strip()
            elif raw_text.startswith("```"):
                lines = raw_text.split("\n")
                raw_text = "\n".join(lines[1:-1]).strip()

            extracted_text = json.loads(raw_text)
            logger.info(f"[{task_id}] Gemini extracted {len(extracted_text)} fields")
        else:
            raise ValueError("No API key")
    except Exception as e:
        logger.warning(f"[{task_id}] Gemini failed: {e}, using mock data")
        extracted_text = {
            "product_name": "Sample Product (Mock)",
            "manufacturer_name": "Mock Manufacturer Pvt. Ltd.",
            "manufacturer_address": "123, Industrial Area, Mumbai",
            "country_of_origin": "India",
            "net_quantity": "500 g", "net_quantity_unit": "g",
            "mrp": "Rs. 199.00", "mrp_currency": "INR",
            "manufacture_date": "08/2026", "expiry_date": "08/2027",
            "batch_number": "BN2026", "customer_care": "1800-123-4567",
            "ingredients": "Wheat flour, sugar, vegetable oil",
            "veg_nonveg_symbol": "green", "fssai_license": "10012345678901",
            "barcode_visible": True,
            "gemini_verdict": "FAIL",
            "gemini_compliance_reasoning": "Mock: The product lacks a clear veg/non-veg logo and the MRP format is improper.",
            "_mock": True,
        }

    # Step 3: Compliance Engine
    try:
        from app.rules.compliance import ComplianceEngine
        compliance_engine = ComplianceEngine()
        compliance_result = compliance_engine.evaluate(cv_results, extracted_text)
        logger.info(f"[{task_id}] Compliance verdict: {compliance_result.get('verdict')}")
    except Exception as e:
        logger.warning(f"[{task_id}] Compliance engine failed: {e}")
        compliance_result = {
            "verdict": extracted_text.get("gemini_verdict", "FAIL"),
            "gemini_reasoning": extracted_text.get("gemini_compliance_reasoning", ""),
            "total_checks": 0, "passed": 0, "failed": 0,
            "checks": [], "violations": [], "warnings": [],
        }

    # Step 4: Save images locally
    scan_dir = STORAGE_DIR / "scans" / task_id
    scan_dir.mkdir(parents=True, exist_ok=True)
    for i, img_bytes in enumerate(images_bytes):
        (scan_dir / f"capture_{i}.jpg").write_bytes(img_bytes)

    result = {
        "task_id": task_id,
        "status": "COMPLETED",
        "compliance": compliance_result,
        "cv_analysis": cv_results,
        "extracted_fields": extracted_text,
        "report_url": None,
        "warnings": [],
    }

    tasks[task_id] = result
    return result


# ── Routes ──

@app.post("/api/scan")
async def submit_scan(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    images_bytes = []
    for file in files:
        data = await file.read()
        if len(data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Each image must be under 10 MB.")
        images_bytes.append(data)

    result = run_scan_pipeline(images_bytes)

    return JSONResponse(
        status_code=202,
        content={
            "task_id": result["task_id"],
            "status": "QUEUED",
            "message": "Scan submitted. Poll /api/status/{task_id} for updates.",
        },
    )


@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    return {
        "task_id": task_id,
        "status": "SUCCESS",
        "result": task,
    }


@app.get("/api/report/{task_id}")
async def get_report(task_id: str):
    task = tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    return {
        "report_url": task.get("report_url"),
        "compliance": task.get("compliance"),
    }


class ComplaintCreate(BaseModel):
    task_id: str
    location: str

@app.post("/api/complaints")
async def create_complaint(data: ComplaintCreate):
    db = get_db()
    db.execute("INSERT INTO complaints (task_id, location) VALUES (?, ?)", (data.task_id, data.location))
    db.commit()
    db.close()
    return {"status": "SUCCESS", "message": "Complaint filed"}


@app.get("/api/admin/complaints")
async def get_complaints(status: Optional[str] = None):
    db = get_db()
    if status in ["OPEN", "SOLVED"]:
        rows = db.execute("SELECT * FROM complaints WHERE status = ? ORDER BY created_at DESC", (status,)).fetchall()
    else:
        rows = db.execute("SELECT * FROM complaints ORDER BY created_at DESC").fetchall()
    db.close()

    return [
        {
            "id": r["id"],
            "task_id": r["task_id"],
            "location": r["location"],
            "status": r["status"],
            "created_at": r["created_at"],
            "report_url": f"/smartscan/reports/{r['task_id']}/report.pdf",
        }
        for r in rows
    ]


@app.get("/api/admin/complaints/stats")
async def get_complaint_stats():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
    today = db.execute("SELECT COUNT(*) FROM complaints WHERE date(created_at) = date('now')").fetchone()[0]
    week = db.execute("SELECT COUNT(*) FROM complaints WHERE created_at >= datetime('now', '-7 days')").fetchone()[0]
    db.close()
    return {"lifetime": total, "today": today, "this_week": week}


@app.put("/api/admin/complaints/{complaint_id}/solve")
async def solve_complaint(complaint_id: int):
    db = get_db()
    cursor = db.execute("UPDATE complaints SET status = 'SOLVED', resolved_at = datetime('now') WHERE id = ?", (complaint_id,))
    if cursor.rowcount == 0:
        db.close()
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.commit()
    db.close()
    return {"status": "SUCCESS"}


@app.get("/health")
async def health():
    return {"status": "healthy", "mode": "dev-standalone"}


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting SmartScan Dev Server on http://localhost:8000")
    logger.info(f"Gemini API key: {'configured' if GEMINI_API_KEY else 'NOT SET'}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
