"""Smart Scan — OpenCV Deterministic Engine.

Performs physical measurement analysis on product label images:
  - Contour detection and label area estimation
  - Font bounding box measurement
  - Surface curvature detection
"""

import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)


class CVEngine:
    """Deterministic computer vision engine for physical label analysis."""

    # Curvature threshold: if ratio of arc length to bounding rect perimeter
    # deviates beyond this, flag as curved surface.
    CURVATURE_THRESHOLD = 0.15

    # Minimum contour area (in pixels) to consider as a valid label region
    MIN_LABEL_AREA = 5000

    # Overexposure threshold for glare detection (backend-side validation)
    GLARE_LUMINANCE_THRESHOLD = 245
    GLARE_PIXEL_RATIO = 0.12

    def analyze(self, image_bytes: bytes) -> dict:
        """
        Run full CV analysis pipeline on the raw image bytes.

        Returns:
            dict with keys:
                - label_area_px: estimated label area in pixels
                - font_metrics: list of detected text bounding boxes with heights
                - curvature_warning: bool
                - curvature_score: float
                - glare_detected: bool
                - contour_count: int
        """
        # Decode image
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image — invalid or corrupted file.")

        results = {
            "image_shape": list(img.shape[:2]),  # [height, width]
            "label_area_px": 0,
            "font_metrics": [],
            "curvature_warning": False,
            "curvature_score": 0.0,
            "glare_detected": False,
            "contour_count": 0,
        }

        # ── Glare detection (backend validation) ──
        results["glare_detected"] = self._detect_glare(img)

        # ── Contour analysis ──
        contours = self._find_label_contours(img)
        results["contour_count"] = len(contours)

        if contours:
            # Use the largest contour as the primary label region
            primary = max(contours, key=cv2.contourArea)
            results["label_area_px"] = int(cv2.contourArea(primary))

            # Curvature detection
            curvature = self._detect_curvature(primary)
            results["curvature_score"] = round(curvature, 4)
            results["curvature_warning"] = curvature > self.CURVATURE_THRESHOLD

        # ── Font metrics via MSER ──
        results["font_metrics"] = self._measure_font_metrics(img)

        return results

    def _detect_glare(self, img: np.ndarray) -> bool:
        """Check if the image has excessive glare / overexposed regions."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        total_pixels = gray.size
        bright_pixels = np.sum(gray > self.GLARE_LUMINANCE_THRESHOLD)
        ratio = bright_pixels / total_pixels
        logger.debug(f"Glare check: {ratio:.2%} pixels above threshold")
        return bool(ratio > self.GLARE_PIXEL_RATIO)

    def _find_label_contours(self, img: np.ndarray) -> list:
        """Find significant contours that may represent label boundaries."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # Adaptive threshold for varying lighting conditions
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2,
        )

        # Morphological closing to fill gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Filter by minimum area
        significant = [c for c in contours if cv2.contourArea(c) >= self.MIN_LABEL_AREA]
        return significant

    def _detect_curvature(self, contour: np.ndarray) -> float:
        """
        Estimate surface curvature from contour shape.

        Compares the contour's arc length against the perimeter of its
        bounding rectangle. A perfectly rectangular (flat) label yields ~0.
        Curved surfaces produce higher deviation.
        """
        arc_length = cv2.arcLength(contour, closed=True)
        x, y, w, h = cv2.boundingRect(contour)
        rect_perimeter = 2 * (w + h)

        if rect_perimeter == 0:
            return 0.0

        deviation = abs(arc_length - rect_perimeter) / rect_perimeter
        return deviation

    def _measure_font_metrics(self, img: np.ndarray) -> list:
        """
        Detect text-like regions using MSER and return font bounding box metrics.

        Returns list of dicts with keys: x, y, w, h, height_px
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        mser = cv2.MSER_create()
        mser.setMinArea(60)
        mser.setMaxArea(14400)

        regions, _ = mser.detectRegions(gray)

        font_metrics = []
        for region in regions:
            x, y, w, h = cv2.boundingRect(region)
            # Filter for plausible text aspect ratios (not too square, not too extreme)
            aspect = w / h if h > 0 else 0
            if 0.1 < aspect < 15 and h > 8:
                font_metrics.append({
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h),
                    "height_px": int(h),
                })

        # Deduplicate overlapping regions
        font_metrics = self._deduplicate_regions(font_metrics)

        logger.info(f"Detected {len(font_metrics)} text regions")
        return font_metrics

    def _deduplicate_regions(self, regions: list, overlap_thresh: float = 0.5) -> list:
        """Remove heavily overlapping bounding boxes, keeping the larger ones."""
        if not regions:
            return []

        # Sort by area descending
        regions.sort(key=lambda r: r["w"] * r["h"], reverse=True)
        keep = []

        for region in regions:
            should_keep = True
            for kept in keep:
                # Calculate IoU
                x1 = max(region["x"], kept["x"])
                y1 = max(region["y"], kept["y"])
                x2 = min(region["x"] + region["w"], kept["x"] + kept["w"])
                y2 = min(region["y"] + region["h"], kept["y"] + kept["h"])

                if x1 < x2 and y1 < y2:
                    intersection = (x2 - x1) * (y2 - y1)
                    area = region["w"] * region["h"]
                    if area > 0 and intersection / area > overlap_thresh:
                        should_keep = False
                        break

            if should_keep:
                keep.append(region)

        return keep
