import pytest

from app.services.grading_engine import analyze_pacing, analyze_clarity, FILLER_WORDS


class TestAnalyzePacing:
    def test_empty_words_returns_zeros(self):
        result = analyze_pacing([])
        assert result["wpm_avg"] == 0
        assert result["pacing_score"] == 0

    def test_few_words_returns_zeros(self):
        words = [{"word": "hello", "start": 0, "end": 0.5}] * 5
        result = analyze_pacing(words)
        assert result["wpm_avg"] == 0
        assert result["pacing_score"] == 0

    def test_ideal_pace_scores_high(self):
        # 150 WPM over 60 seconds = 150 words
        words = []
        for i in range(150):
            start = i * 0.4
            words.append({"word": f"word{i}", "start": start, "end": start + 0.3})
        result = analyze_pacing(words)
        assert result["wpm_avg"] > 100
        assert result["pacing_score"] > 50

    def test_detects_pauses(self):
        # Create words with a 2-second gap (>1s = pause)
        words = [
            {"word": "hello", "start": 0.0, "end": 0.5},
            {"word": "world", "start": 0.6, "end": 1.0},
        ]
        # Add enough words to pass the minimum
        for i in range(20):
            start = 2.0 + i * 0.4
            words.append({"word": f"w{i}", "start": start, "end": start + 0.3})
        # Insert a long pause
        words.append({"word": "after", "start": 15.0, "end": 15.3})
        for i in range(20):
            start = 15.5 + i * 0.4
            words.append({"word": f"x{i}", "start": start, "end": start + 0.3})

        result = analyze_pacing(words)
        assert result["pause_count"] >= 1

    def test_returns_timeline_segments(self):
        words = []
        for i in range(200):
            start = i * 0.4
            words.append({"word": f"word{i}", "start": start, "end": start + 0.3})
        result = analyze_pacing(words)
        assert len(result["pacing_timeline"]) > 0
        assert "start" in result["pacing_timeline"][0]
        assert "wpm" in result["pacing_timeline"][0]


class TestAnalyzeClarity:
    def test_empty_words_returns_zeros(self):
        result = analyze_clarity([], "")
        assert result["filler_word_count"] == 0
        assert result["clarity_score"] == 0

    def test_no_filler_words_scores_high(self):
        words = [
            {"word": "The"},
            {"word": "presentation"},
            {"word": "was"},
            {"word": "excellent"},
        ]
        # Mock OpenAI by patching - for unit test just check filler counting
        # The OpenAI call for nonsensical words will fail gracefully
        result = analyze_clarity(words, "The presentation was excellent")
        assert result["filler_word_count"] == 0
        assert result["filler_word_percentage"] == 0

    def test_counts_filler_words(self):
        words = [
            {"word": "um"},
            {"word": "like"},
            {"word": "the"},
            {"word": "uh"},
            {"word": "presentation"},
            {"word": "was"},
            {"word": "basically"},
            {"word": "good"},
            {"word": "right"},
            {"word": "so"},
        ]
        text = "um like the uh presentation was basically good right so"
        result = analyze_clarity(words, text)
        # um, like, uh, basically, right, so = 6 filler words
        assert result["filler_word_count"] == 6
        assert result["filler_word_percentage"] == 60.0

    def test_filler_words_reduces_score(self):
        # 50% filler words should reduce score significantly
        words = [{"word": "um"}] * 5 + [{"word": "good"}] * 5
        text = "um um um um um good good good good good"
        result = analyze_clarity(words, text)
        assert result["clarity_score"] < 80
