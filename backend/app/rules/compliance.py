"""Smart Scan — Compliance Rule Engine.

Validates extracted label data against the Legal Metrology
(Packaged Commodities) Rules, 2011.

Key rules implemented:
  - Mandatory declarations must be present
  - Font size minimums based on principal display panel area
  - MRP format validation
  - Date format validation
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ── Legal Metrology font size thresholds ──
# Based on principal display panel area (cm²) → minimum font height (mm)
FONT_SIZE_RULES = [
    {"max_area_cm2": 100, "min_font_mm": 1.0},
    {"max_area_cm2": 500, "min_font_mm": 2.0},
    {"max_area_cm2": 2500, "min_font_mm": 4.0},
    {"max_area_cm2": float("inf"), "min_font_mm": 6.0},
]

# Mandatory fields per Legal Metrology Rules, 2011
MANDATORY_FIELDS = [
    "product_name",
    "manufacturer_name",
    "manufacturer_address",
    "net_quantity",
    "mrp",
    "manufacture_date",
    "customer_care",
]


class ComplianceEngine:
    """Evaluates label data against Legal Metrology Rules, 2011."""

    def evaluate(self, cv_results: dict, extracted_text: dict) -> dict:
        """
        Run all compliance checks.

        Args:
            cv_results:     Output from CVEngine.analyze()
            extracted_text: Output from GeminiExtractor.extract_label_info()

        Returns:
            dict with verdict (PASS/FAIL/WARNING), individual check results,
            and a list of violations.
        """
        checks = []
        violations = []
        warnings = []

        # ── Check 1: Mandatory declarations ──
        for field in MANDATORY_FIELDS:
            value = extracted_text.get(field)
            present = value is not None and value != "" and value != "null"

            check = {
                "rule": f"mandatory_field_{field}",
                "description": f"Mandatory declaration: {field.replace('_', ' ').title()}",
                "status": "PASS" if present else "FAIL",
                "value": value if present else None,
            }
            checks.append(check)

            if not present:
                violations.append(
                    f"Missing mandatory declaration: {field.replace('_', ' ').title()}"
                )

        # ── Check 2: MRP format ──
        mrp_check = self._check_mrp_format(extracted_text.get("mrp"))
        checks.append(mrp_check)
        if mrp_check["status"] == "FAIL":
            violations.append(mrp_check["description"])

        # ── Check 3: Date format ──
        for date_field in ["manufacture_date", "expiry_date"]:
            date_value = extracted_text.get(date_field)
            if date_value:
                date_check = self._check_date_format(date_field, date_value)
                checks.append(date_check)
                if date_check["status"] == "FAIL":
                    violations.append(date_check["description"])

        # ── Check 4: Font size compliance ──
        font_check = self._check_font_size(cv_results)
        checks.append(font_check)
        if font_check["status"] == "FAIL":
            violations.append(font_check["description"])
        elif font_check["status"] == "WARNING":
            warnings.append(font_check["description"])

        # ── Check 5: Net quantity unit ──
        nq_check = self._check_net_quantity(extracted_text)
        checks.append(nq_check)
        if nq_check["status"] == "FAIL":
            violations.append(nq_check["description"])

        # ── Curvature warning ──
        if cv_results.get("curvature_warning"):
            warnings.append(
                "Curved surface detected — measurements may have a margin of error."
            )

        # ── Determine overall verdict ──
        # Priority: deterministic rule checks > Gemini AI verdict
        has_failures = any(c["status"] == "FAIL" for c in checks)
        has_warnings = len(warnings) > 0
        
        gemini_verdict = extracted_text.get("gemini_verdict")
        gemini_reasoning = extracted_text.get("gemini_compliance_reasoning")

        # Deterministic checks take priority
        if has_failures:
            verdict = "FAIL"
        elif has_warnings:
            verdict = "WARNING"
        elif gemini_verdict in ["FAIL", "WARNING"] and not has_failures:
            # Gemini flagged an issue the rule engine didn't catch — escalate as WARNING
            verdict = "WARNING"
            warnings.append(f"Gemini AI flagged a concern: {gemini_reasoning}")
        else:
            verdict = "PASS"

        return {
            "verdict": verdict,
            "gemini_reasoning": gemini_reasoning,
            "total_checks": len(checks),
            "passed": sum(1 for c in checks if c["status"] == "PASS"),
            "failed": sum(1 for c in checks if c["status"] == "FAIL"),
            "checks": checks,
            "violations": violations,
            "warnings": warnings,
        }

    def _check_mrp_format(self, mrp: Optional[str]) -> dict:
        """Validate MRP follows format: '₹XX.XX' or 'Rs. XX.XX' or 'MRP ₹XX'."""
        if not mrp:
            return {
                "rule": "mrp_format",
                "description": "MRP format validation",
                "status": "FAIL",
                "value": None,
            }

        # Accept common Indian MRP formats
        patterns = [
            r"₹\s*\d+\.?\d*",
            r"Rs\.?\s*\d+\.?\d*",
            r"MRP\s*[:.]?\s*₹?\s*\d+\.?\d*",
            r"M\.R\.P\s*[:.]?\s*₹?\s*\d+\.?\d*",
            r"\d+\.\d{2}",  # Bare decimal (e.g. "199.00")
        ]

        for pattern in patterns:
            if re.search(pattern, mrp, re.IGNORECASE):
                return {
                    "rule": "mrp_format",
                    "description": "MRP format validation",
                    "status": "PASS",
                    "value": mrp,
                }

        return {
            "rule": "mrp_format",
            "description": f"MRP format unrecognized: '{mrp}'",
            "status": "FAIL",
            "value": mrp,
        }

    def _check_date_format(self, field: str, value: str) -> dict:
        """Validate date fields are in a recognizable format."""
        label = field.replace("_", " ").title()
        patterns = [
            r"\d{2}/\d{2}/\d{4}",     # DD/MM/YYYY
            r"\d{2}-\d{2}-\d{4}",     # DD-MM-YYYY
            r"\d{2}/\d{4}",           # MM/YYYY
            r"\d{2}-\d{4}",           # MM-YYYY
            r"[A-Za-z]+\s*\d{4}",     # Month YYYY
            r"\d{4}-\d{2}-\d{2}",     # YYYY-MM-DD (ISO)
            r"\d{2}\.\d{2}\.\d{4}",   # DD.MM.YYYY
        ]

        for pattern in patterns:
            if re.search(pattern, value):
                return {
                    "rule": f"date_format_{field}",
                    "description": f"{label} format validation",
                    "status": "PASS",
                    "value": value,
                }

        return {
            "rule": f"date_format_{field}",
            "description": f"{label} format unrecognized: '{value}'",
            "status": "FAIL",
            "value": value,
        }

    def _check_font_size(self, cv_results: dict) -> dict:
        """
        Check if detected font heights meet minimum size requirements.
        Note: Without a physical reference, this is an approximate check.
        """
        font_metrics = cv_results.get("font_metrics", [])

        if not font_metrics:
            return {
                "rule": "font_size_minimum",
                "description": "Font size compliance (no text regions detected)",
                "status": "WARNING",
                "value": None,
            }

        heights = [m["height_px"] for m in font_metrics]
        min_height = min(heights) if heights else 0
        avg_height = sum(heights) / len(heights) if heights else 0

        # Without a physical reference object, we can only flag dangerously
        # small text relative to image size
        img_height = cv_results.get("image_shape", [1000])[0]
        relative_min = min_height / img_height if img_height > 0 else 0

        if relative_min < 0.005:  # Less than 0.5% of image height
            return {
                "rule": "font_size_minimum",
                "description": "Some text appears extremely small — may violate minimum font size rules",
                "status": "WARNING",
                "value": f"min={min_height}px, avg={avg_height:.0f}px, relative={relative_min:.4f}",
            }

        return {
            "rule": "font_size_minimum",
            "description": "Font sizes appear within acceptable range",
            "status": "PASS",
            "value": f"min={min_height}px, avg={avg_height:.0f}px",
        }

    def _check_net_quantity(self, extracted_text: dict) -> dict:
        """Validate net quantity includes a recognized unit of measurement."""
        nq = extracted_text.get("net_quantity")
        unit = extracted_text.get("net_quantity_unit")

        if not nq:
            return {
                "rule": "net_quantity_unit",
                "description": "Net quantity with standard unit",
                "status": "FAIL",
                "value": None,
            }

        valid_units = {"g", "gm", "kg", "ml", "l", "cc", "cm", "m", "mm", "pcs", "nos", "units"}

        if unit and unit.lower().strip(".") in valid_units:
            return {
                "rule": "net_quantity_unit",
                "description": "Net quantity with standard unit",
                "status": "PASS",
                "value": f"{nq} ({unit})",
            }

        # Try to find unit in the quantity string itself
        for u in valid_units:
            if re.search(rf"\b{u}\b", nq, re.IGNORECASE):
                return {
                    "rule": "net_quantity_unit",
                    "description": "Net quantity with standard unit",
                    "status": "PASS",
                    "value": nq,
                }

        return {
            "rule": "net_quantity_unit",
            "description": f"Net quantity unit unclear: '{nq}'",
            "status": "FAIL",
            "value": nq,
        }
