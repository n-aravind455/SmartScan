"""Smart Scan — Gemini 1.5 Flash/Pro integration for semantic label text extraction."""

import json
import logging
import google.generativeai as genai
from app.config import settings

logger = logging.getLogger(__name__)

# The structured prompt that guides Gemini to extract legal metrology fields
EXTRACTION_PROMPT = """You are an expert label reader for Indian packaged commodities.
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
  "barcode_visible": true/false,
  "other_declarations": ["Any other mandatory declarations found"],
  "gemini_verdict": "PASS or FAIL or WARNING",
  "gemini_compliance_reasoning": "Write a 2-3 sentence explanation directly judging compliance with Indian Legal Metrology Rules, 2011, based on the fields you found."
}

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.
If a field is partially visible or unclear, provide your best reading and
add a key "uncertain_fields" listing those field names.
"""


class GeminiExtractor:
    """Wrapper around the Gemini generative AI API for label text extraction."""

    def __init__(self):
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            logger.warning("Gemini API key not configured — using mock extraction.")
            self._mock = True
        else:
            self._mock = False
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-flash-lite-latest")

    def extract_label_info(self, image_bytes_list: list) -> dict:
        """
        Send multiple images to Gemini and extract structured label information.

        Args:
            image_bytes_list: List of raw image bytes (JPEG/PNG) from different angles.

        Returns:
            dict of extracted label fields.
        """
        if self._mock:
            return self._mock_extraction()

        try:
            parts = [EXTRACTION_PROMPT]
            for img_bytes in image_bytes_list:
                parts.append({
                    "mime_type": "image/jpeg",
                    "data": img_bytes,
                })

            response = self.model.generate_content(
                parts,
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=8192,
                ),
            )

            raw_text = response.text.strip()

            # Robust JSON extraction
            import re
            match = re.search(r"```(?:json)?\s*\n(.*?)\n```", raw_text, re.DOTALL)
            if match:
                raw_text = match.group(1).strip()
            elif raw_text.startswith("```"):
                lines = raw_text.split("\n")
                raw_text = "\n".join(lines[1:-1]).strip()

            result = json.loads(raw_text)
            logger.info(f"Gemini extracted {len(result)} fields")
            return result

        except json.JSONDecodeError as e:
            logger.error(f"Gemini returned invalid JSON: {e}")
            logger.error(f"RAW TEXT: {raw_text}")
            return {"error": "Failed to parse Gemini response", "raw": raw_text}
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            return {"error": str(e)}

    def _mock_extraction(self) -> dict:
        """Return mock data when Gemini API key is not configured."""
        return {
            "product_name": "Sample Product (Mock)",
            "manufacturer_name": "Mock Manufacturer Pvt. Ltd.",
            "manufacturer_address": "123, Industrial Area, Mumbai, Maharashtra 400001",
            "country_of_origin": "India",
            "net_quantity": "500 g",
            "net_quantity_unit": "g",
            "mrp": "₹199.00",
            "mrp_currency": "INR",
            "manufacture_date": "08/2026",
            "expiry_date": "08/2027",
            "batch_number": "BN2026-0842",
            "customer_care": "1800-123-4567",
            "ingredients": "Wheat flour, sugar, vegetable oil, salt",
            "nutritional_info": "Energy: 450 kcal per 100g",
            "allergen_info": "Contains wheat, may contain traces of nuts",
            "veg_nonveg_symbol": "green",
            "fssai_license": "10012345678901",
            "barcode_visible": True,
            "other_declarations": ["Best stored in cool dry place"],
            "gemini_verdict": "FAIL",
            "gemini_compliance_reasoning": "The product lacks a clear veg/non-veg logo and the MRP is improperly formatted. Not fully compliant with Legal Metrology rules.",
            "uncertain_fields": [],
            "_mock": True,
        }
