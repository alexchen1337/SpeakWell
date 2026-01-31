"""Secure File Upload Validation

Provides magic byte validation and comprehensive file type checking
to prevent malicious file uploads and path traversal attacks.
"""
import os
import mimetypes
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status

# Magic bytes for common audio formats
AUDIO_MAGIC_BYTES = {
    # MP3
    b'\xFF\xFB': 'audio/mpeg',
    b'\xFF\xF3': 'audio/mpeg',
    b'\xFF\xF2': 'audio/mpeg',
    b'ID3': 'audio/mpeg',
    
    # WAV
    b'RIFF': 'audio/wav',
    
    # OGG
    b'OggS': 'audio/ogg',
    
    # FLAC
    b'fLaC': 'audio/flac',
    
    # M4A/AAC
    b'\x00\x00\x00\x20ftyp': 'audio/mp4',
    b'\x00\x00\x00\x18ftyp': 'audio/mp4',
    b'\x00\x00\x00\x1cftyp': 'audio/mp4',
    
    # WebM
    b'\x1a\x45\xdf\xa3': 'audio/webm',
}

# Allowed audio file extensions
ALLOWED_AUDIO_EXTENSIONS = {
    '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.weba', '.webm', '.opus'
}

# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024


class FileValidator:
    """Validate uploaded files for security"""
    
    @staticmethod
    def check_magic_bytes(file_contents: bytes) -> Optional[str]:
        """Check file magic bytes to determine actual file type
        
        Args:
            file_contents: First bytes of the file
            
        Returns:
            Detected MIME type or None if not recognized
        """
        # Check against known audio magic bytes
        for magic_bytes, mime_type in AUDIO_MAGIC_BYTES.items():
            if file_contents.startswith(magic_bytes):
                return mime_type
        
        # Special case for MP4/M4A - check ftyp box
        if len(file_contents) >= 12:
            if b'ftyp' in file_contents[4:12]:
                # Check for M4A specific brands
                ftyp_data = file_contents[8:16]
                if b'M4A' in ftyp_data or b'mp42' in ftyp_data:
                    return 'audio/mp4'
        
        return None
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent path traversal attacks
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
            
        Raises:
            HTTPException: If filename is invalid
        """
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename cannot be empty"
            )
        
        # Remove any path components
        filename = os.path.basename(filename)
        
        # Check for path traversal attempts
        if ".." in filename or filename.startswith("/") or "\\" in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename: path traversal attempt detected"
            )
        
        # Remove null bytes
        filename = filename.replace("\x00", "")
        
        # Check length
        if len(filename) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename too long (max 255 characters)"
            )
        
        return filename
    
    @staticmethod
    def validate_audio_file(file: UploadFile, file_contents: bytes) -> Tuple[str, str]:
        """Comprehensive validation of uploaded audio file
        
        Args:
            file: UploadFile object
            file_contents: File contents (at least first 16 bytes)
            
        Returns:
            Tuple of (sanitized_filename, validated_mime_type)
            
        Raises:
            HTTPException: If validation fails
        """
        # Sanitize filename
        sanitized_filename = FileValidator.sanitize_filename(file.filename)
        
        # Check file extension
        file_ext = os.path.splitext(sanitized_filename)[1].lower()
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{file_ext}' not allowed. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
            )
        
        # Check file size
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
        
        # Validate content type from header
        content_type = file.content_type
        if not content_type or not content_type.startswith("audio/"):
            # Try to guess from extension
            guessed_type, _ = mimetypes.guess_type(sanitized_filename)
            if not guessed_type or not guessed_type.startswith("audio/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File does not appear to be an audio file"
                )
            content_type = guessed_type
        
        # Magic byte validation (most important security check)
        if len(file_contents) >= 16:
            detected_mime = FileValidator.check_magic_bytes(file_contents)
            if not detected_mime:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File content does not match any known audio format (magic byte validation failed)"
                )
            
            # Use detected MIME type (more reliable than client-provided)
            content_type = detected_mime
        else:
            # File too small to validate properly
            if len(file_contents) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File is empty"
                )
        
        return sanitized_filename, content_type
    
    @staticmethod
    def validate_file_size_streaming(current_size: int) -> None:
        """Validate file size during streaming upload
        
        Args:
            current_size: Current number of bytes read
            
        Raises:
            HTTPException: If size exceeds maximum
        """
        if current_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB"
            )
