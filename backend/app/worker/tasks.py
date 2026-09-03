"""Smart Scan — Celery task: orchestrates the full scan processing pipeline.

Flow:
  1. Decode uploaded image
  2. Run OpenCV deterministic analysis (curvature, font metrics, label area)
  3. Run Gemini AI semantic text extraction
  4. Pass both outputs to the compliance rule engine
  5. Generate PDF report via WeasyPrint
  6. Upload image + report to MinIO
  7. Log transaction to PostgreSQL
"""

import base64
import logging
from app.worker.celery_app import celery_app
from app.cv.engine import CVEngine
from app.ai.gemini import GeminiExtractor
from app.rules.compliance import ComplianceEngine
from app.reports.pdf import ReportGenerator
from app.storage.minio_client import StorageClient

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="smartscan.process_scan", max_retries=2)
def process_scan(self, images_payload: list) -> dict:
    """
    Main scan processing task — runs the full Smart Scan pipeline for multiple images.

    Args:
        images_payload: List of dicts with keys 'image_b64', 'filename', 'content_type'.

    Returns:
        dict with compliance result, warnings, and report URL.
    """
    task_id = self.request.id
    primary_filename = images_payload[0]["filename"] if images_payload else "unknown"
    logger.info(f"[{task_id}] Starting scan processing for {len(images_payload)} images.")

    try:
        # ── Step 1: Decode image ──
        self.update_state(state="PROCESSING", meta={"step": "decoding_image"})
        all_image_bytes = []
        for img_payload in images_payload:
            all_image_bytes.append(base64.b64decode(img_payload["image_b64"]))
        logger.info(f"[{task_id}] Decoded {len(all_image_bytes)} images")

        # ── Step 2: OpenCV deterministic analysis ──
        self.update_state(state="PROCESSING", meta={"step": "cv_analysis"})
        cv_engine = CVEngine()
        # CV Engine runs specifically on the first image for now
        cv_results = cv_engine.analyze(all_image_bytes[0])
        logger.info(f"[{task_id}] CV analysis complete: curvature_warning={cv_results.get('curvature_warning')}")

        # ── Step 3: Gemini AI text extraction ──
        self.update_state(state="PROCESSING", meta={"step": "ai_extraction"})
        gemini = GeminiExtractor()
        extracted_text = gemini.extract_label_info(all_image_bytes)
        logger.info(f"[{task_id}] Gemini extraction complete: {len(extracted_text)} fields found")

        # ── Step 4: Compliance rule engine ──
        self.update_state(state="PROCESSING", meta={"step": "compliance_check"})
        compliance_engine = ComplianceEngine()
        compliance_result = compliance_engine.evaluate(
            cv_results=cv_results,
            extracted_text=extracted_text,
        )
        logger.info(f"[{task_id}] Compliance check: verdict={compliance_result.get('verdict')}")

        # ── Step 5: Generate PDF report ──
        self.update_state(state="PROCESSING", meta={"step": "generating_report"})
        report_gen = ReportGenerator()
        pdf_bytes = report_gen.generate(
            task_id=task_id,
            filename=primary_filename,
            cv_results=cv_results,
            extracted_text=extracted_text,
            compliance_result=compliance_result,
        )
        logger.info(f"[{task_id}] PDF report generated: {len(pdf_bytes)} bytes")

        # ── Step 6: Upload to MinIO ──
        self.update_state(state="PROCESSING", meta={"step": "uploading"})
        storage = StorageClient()
        
        image_urls = []
        for i, img_bytes in enumerate(all_image_bytes):
            fname = images_payload[i]["filename"]
            ctype = images_payload[i]["content_type"]
            img_url = storage.upload(
                object_name=f"scans/{task_id}/{i}_{fname}",
                data=img_bytes,
                content_type=ctype,
            )
            image_urls.append(img_url)
            
        report_url = storage.upload(
            object_name=f"reports/{task_id}/report.pdf",
            data=pdf_bytes,
            content_type="application/pdf",
        )
        logger.info(f"[{task_id}] Uploaded to MinIO: images={len(image_urls)}, report={report_url}")

        # ── Step 7: Return result ──
        result = {
            "task_id": task_id,
            "status": "COMPLETED",
            "compliance": compliance_result,
            "cv_analysis": cv_results,
            "extracted_fields": extracted_text,
            "image_url": image_urls[0], # Maintain backwards compatibility by returning the primary URL
            "image_urls": image_urls,
            "report_url": report_url,
            "warnings": [],
        }

        if cv_results.get("curvature_warning"):
            result["warnings"].append(
                "Curved surface measurements may have a margin of error."
            )

        return result

    except Exception as exc:
        logger.exception(f"[{task_id}] Scan processing failed: {exc}")
        self.update_state(state="FAILURE", meta={"error": str(exc)})
        raise self.retry(exc=exc, countdown=10)
