"""
Safe Document Storage and Ingestion Service.
Handles safe validation (size, MIME type, password protection), SHA-256 computation,
and protected local directory storage.
"""

import os
import hashlib
import shutil
from typing import Tuple, Dict, Any
from fastapi import UploadFile, HTTPException, status
import fitz  # PyMuPDF
from PIL import Image

from apps.api.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


class StorageService:
    def __init__(self, storage_dir: str = settings.STORAGE_LOCAL_DIR):
        self.storage_dir = os.path.abspath(storage_dir)
        os.makedirs(self.storage_dir, exist_ok=True)

    def validate_and_store_file(
        self,
        application_id: str,
        upload_file: UploadFile
    ) -> Dict[str, Any]:
        """
        Validates the incoming file stream, computes SHA-256,
        ensures safe PDF constraints, and writes to isolated directory.
        """
        orig_filename = upload_file.filename or "unnamed_document"
        ext = os.path.splitext(orig_filename)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension '{ext}'. Only PDF, JPG, and PNG are accepted."
            )

        # Create application subfolder
        app_storage_dir = os.path.join(self.storage_dir, application_id)
        os.makedirs(app_storage_dir, exist_ok=True)

        # Read content and compute SHA-256 hash
        hasher = hashlib.sha256()
        file_bytes = upload_file.file.read()
        file_size = len(file_bytes)

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum permitted size of 25MB (Received {file_size / (1024*1024):.2f}MB)."
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file rejected."
            )

        hasher.update(file_bytes)
        sha256_hash = hasher.hexdigest()

        # Generate unique storage filename with hash prefix
        safe_filename = f"{sha256_hash[:16]}_{os.path.basename(orig_filename)}"
        target_path = os.path.join(app_storage_dir, safe_filename)

        with open(target_path, "wb") as f_out:
            f_out.write(file_bytes)

        # Validate PDF integrity and check password protection
        page_count = 1
        mime_type = upload_file.content_type or "application/octet-stream"

        if ext == ".pdf":
            try:
                doc = fitz.open(target_path)
                if doc.is_encrypted:
                    doc.close()
                    os.remove(target_path)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Password-protected or encrypted PDFs are rejected. Submit an unencrypted copy."
                    )
                page_count = doc.page_count
                doc.close()
                mime_type = "application/pdf"
            except Exception as e:
                if os.path.exists(target_path):
                    os.remove(target_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or corrupted PDF file: {str(e)}"
                )
        elif ext in {".jpg", ".jpeg", ".png"}:
            try:
                with Image.open(target_path) as img:
                    img.verify()
                mime_type = "image/jpeg" if ext in {".jpg", ".jpeg"} else "image/png"
            except Exception as e:
                if os.path.exists(target_path):
                    os.remove(target_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or corrupted image file: {str(e)}"
                )

        return {
            "filename": safe_filename,
            "original_filename": orig_filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "hash_sha256": sha256_hash,
            "storage_path": target_path,
            "page_count": page_count,
        }


storage_service = StorageService()
