from typing import Optional


# Audio responses are plain dicts to match the exact current API shape.
# No Pydantic response model needed — the routes return dicts directly.

def build_audio_response(
    audio_id: str,
    filename: str,
    url: str,
    file_size: Optional[int],
    duration: Optional[int],
    status: str,
    created_at_iso: str,
    updated_at_iso: Optional[str] = None,
) -> dict:
    result = {
        "id": audio_id,
        "title": filename,
        "filename": filename,
        "url": url,
        "size": file_size,
        "duration": duration,
        "status": status,
        "uploadedAt": created_at_iso,
    }
    if updated_at_iso is not None:
        result["updatedAt"] = updated_at_iso
    return result
