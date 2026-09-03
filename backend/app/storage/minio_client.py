"""Smart Scan — MinIO Object Storage Client."""

import io
import logging
from minio import Minio
from minio.error import S3Error
from app.config import settings

logger = logging.getLogger(__name__)


class StorageClient:
    """MinIO S3-compatible storage client for images and reports."""

    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ROOT_USER,
            secret_key=settings.MINIO_ROOT_PASSWORD,
            secure=False,  # Local development — no TLS
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Create the bucket if it doesn't exist."""
        import json
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"Created MinIO bucket: {self.bucket}")
            
            # Ensure the bucket allows public read for the Next.js proxy
            policy = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": "*"},
                        "Action": ["s3:GetObject"],
                        "Resource": [f"arn:aws:s3:::{self.bucket}/*"]
                    }
                ]
            }
            self.client.set_bucket_policy(self.bucket, json.dumps(policy))
        except S3Error as e:
            logger.error(f"MinIO bucket check failed: {e}")

    def upload(self, object_name: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """
        Upload bytes to MinIO.

        Args:
            object_name: Path within the bucket (e.g., 'scans/task123/image.jpg').
            data: Raw bytes to upload.
            content_type: MIME type.

        Returns:
            URL path to the stored object.
        """
        try:
            stream = io.BytesIO(data)
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=stream,
                length=len(data),
                content_type=content_type,
            )
            url = f"/{self.bucket}/{object_name}"
            logger.info(f"Uploaded to MinIO: {url}")
            return url
        except S3Error as e:
            logger.error(f"MinIO upload failed: {e}")
            raise

    def download(self, object_name: str) -> bytes:
        """Download an object from MinIO and return its bytes."""
        try:
            response = self.client.get_object(self.bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"MinIO download failed: {e}")
            raise

    def get_presigned_url(self, object_name: str, expires_hours: int = 1) -> str:
        """Generate a presigned URL for temporary access."""
        from datetime import timedelta
        try:
            url = self.client.presigned_get_object(
                self.bucket,
                object_name,
                expires=timedelta(hours=expires_hours),
            )
            return url
        except S3Error as e:
            logger.error(f"Presigned URL generation failed: {e}")
            raise
