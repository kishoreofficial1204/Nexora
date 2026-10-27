"""
Pluggable OCR Engine Interface for Nexora.
Abstracts OCR backends (RapidOCR, Tesseract) behind a uniform contract.
Extracts text, word/line bounding boxes, and confidence scores.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image


class OcrBlock:
    def __init__(self, text: str, bbox: List[float], confidence: float):
        self.text = text
        self.bbox = bbox  # [x0, y0, x1, y1]
        self.confidence = confidence

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "bbox": self.bbox,
            "confidence": round(self.confidence, 4)
        }


class BaseOcrEngine(ABC):
    @abstractmethod
    def extract_text_and_boxes(self, img: Image.Image) -> List[OcrBlock]:
        """Extracts text blocks with coordinates and confidence from a PIL image."""
        pass


class RapidOcrEngine(BaseOcrEngine):
    def __init__(self):
        from rapidocr_onnxruntime import RapidOCR
        self.engine = RapidOCR()

    def extract_text_and_boxes(self, img: Image.Image) -> List[OcrBlock]:
        img_np = np.array(img.convert("RGB"))
        result, _ = self.engine(img_np)
        blocks: List[OcrBlock] = []

        if not result:
            return blocks

        for line in result:
            # line structure: [ [ [x0,y0], [x1,y0], [x1,y1], [x0,y1] ], text, score ]
            poly_coords = line[0]
            text = str(line[1]).strip()
            score = float(line[2])

            xs = [pt[0] for pt in poly_coords]
            ys = [pt[1] for pt in poly_coords]
            bbox = [float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))]

            blocks.append(OcrBlock(text=text, bbox=bbox, confidence=score))

        return blocks


class TesseractOcrEngine(BaseOcrEngine):
    def __init__(self):
        import pytesseract
        self.pytesseract = pytesseract

    def extract_text_and_boxes(self, img: Image.Image) -> List[OcrBlock]:
        try:
            data = self.pytesseract.image_to_data(img, output_type=self.pytesseract.Output.DICT)
            blocks: List[OcrBlock] = []
            n_boxes = len(data["text"])
            for i in range(n_boxes):
                text = data["text"][i].strip()
                conf = float(data["conf"][i])
                if text and conf > 0:
                    x, y, w, h = data["left"][i], data["top"][i], data["width"][i], data["height"][i]
                    bbox = [float(x), float(y), float(x + w), float(y + h)]
                    blocks.append(OcrBlock(text=text, bbox=bbox, confidence=conf / 100.0))
            return blocks
        except Exception:
            return []


# Global Singleton Factory
_active_engine: Optional[BaseOcrEngine] = None


def get_ocr_engine() -> BaseOcrEngine:
    global _active_engine
    if _active_engine is None:
        try:
            _active_engine = RapidOcrEngine()
        except Exception:
            _active_engine = TesseractOcrEngine()
    return _active_engine
