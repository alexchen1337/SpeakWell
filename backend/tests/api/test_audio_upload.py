import pytest


class _DummyBucket:
    def __init__(self):
        self.upload_calls = []
        self.removed_paths = []

    def upload(self, path, file, file_options):
        self.upload_calls.append(
            {
                "path": path,
                "file": file,
                "file_options": file_options,
            }
        )

    def remove(self, paths):
        self.removed_paths.extend(paths)


class _DummyStorage:
    def __init__(self, bucket: _DummyBucket):
        self._bucket = bucket

    def from_(self, _bucket_name):
        return self._bucket


class _DummyStorageClient:
    def __init__(self, bucket: _DummyBucket):
        self.storage = _DummyStorage(bucket)


@pytest.fixture
def mock_upload_dependencies(monkeypatch):
    bucket = _DummyBucket()
    storage_client = _DummyStorageClient(bucket)

    monkeypatch.setattr("app.services.audio_service.get_storage_client", lambda: storage_client)
    monkeypatch.setattr(
        "app.services.audio_service.generate_signed_url",
        lambda object_key: f"https://files.local/{object_key}",
    )
    monkeypatch.setattr("app.services.audio_service.extract_audio_duration", lambda *_args, **_kwargs: 42)
    monkeypatch.setattr("app.services.transcription_service.transcribe_audio_file", lambda *_args, **_kwargs: None)

    return bucket


class TestAudioUpload:
    def test_upload_video_preserves_original_video(self, auth_client, mock_upload_dependencies, monkeypatch):
        convert_calls = []

        def fake_convert(_contents, filename):
            convert_calls.append(filename)
            return b"", "unused.mp3"

        monkeypatch.setattr("app.services.audio_service._convert_video_to_mp3", fake_convert)

        response = auth_client.post(
            "/api/audio/upload",
            files=[("audio", ("demo.mp4", b"video-bytes", "video/mp4"))],
        )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["filename"] == "demo.mp4"
        assert payload[0]["size"] == len(b"video-bytes")
        assert payload[0]["status"] == "uploaded"

        assert len(mock_upload_dependencies.upload_calls) == 1
        upload_call = mock_upload_dependencies.upload_calls[0]
        assert upload_call["path"].endswith(".mp4")
        assert upload_call["file"] == b"video-bytes"
        assert upload_call["file_options"]["content-type"] == "video/mp4"
        assert convert_calls == []

    def test_rejects_unsupported_file_type(self, auth_client, mock_upload_dependencies):
        response = auth_client.post(
            "/api/audio/upload",
            files=[("audio", ("notes.txt", b"plain-text", "text/plain"))],
        )

        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]
        assert len(mock_upload_dependencies.upload_calls) == 0

    def test_mixed_audio_and_video_upload(self, auth_client, mock_upload_dependencies, monkeypatch):
        convert_calls = []

        def fake_convert(_contents, filename):
            convert_calls.append(filename)
            return b"", "unused.mp3"

        monkeypatch.setattr("app.services.audio_service._convert_video_to_mp3", fake_convert)

        response = auth_client.post(
            "/api/audio/upload",
            files=[
                ("audio", ("voice.m4a", b"audio-bytes", "audio/mp4")),
                ("audio", ("clip.mov", b"video-bytes", "video/quicktime")),
            ],
        )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 2
        assert convert_calls == []
        assert any(item["filename"] == "voice.m4a" for item in payload)
        assert any(item["filename"] == "clip.mov" for item in payload)

        content_types = [call["file_options"]["content-type"] for call in mock_upload_dependencies.upload_calls]
        assert "audio/mp4" in content_types
        assert "video/quicktime" in content_types

    def test_video_upload_with_generic_content_type_uses_extension(self, auth_client, mock_upload_dependencies):
        response = auth_client.post(
            "/api/audio/upload",
            files=[("audio", ("clip.webm", b"webm-bytes", "application/octet-stream"))],
        )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["filename"] == "clip.webm"

        assert len(mock_upload_dependencies.upload_calls) == 1
        upload_call = mock_upload_dependencies.upload_calls[0]
        assert upload_call["path"].endswith(".webm")
        assert upload_call["file"] == b"webm-bytes"
        assert upload_call["file_options"]["content-type"] == "video/webm"
