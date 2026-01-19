import os
import json
import re
from typing import List, Dict, Optional
from statistics import mean, variance
from openai import OpenAI
from sqlalchemy.orm import Session
from database import Grading, Transcript, Rubric, RubricCriterion, GradingStatus

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

FILLER_WORDS = {
    "um", "uh", "like", "you know", "so", "actually", "basically",
    "literally", "kind of", "sort of", "i mean", "you see", "right",
    "okay", "well", "anyway", "just"
}


def analyze_pacing(words: List[dict]) -> dict:
    """
    Calculate pacing metrics from word timestamps.

    Args:
        words: List of word objects with 'word', 'start', 'end' timestamps

    Returns:
        dict with pacing metrics and score
    """
    if not words or len(words) < 10:
        return {
            "wpm_avg": 0,
            "wpm_variance": 0,
            "pause_count": 0,
            "pause_avg_duration": 0,
            "pacing_score": 0,
            "pacing_timeline": []
        }

    # Calculate total duration
    start_time = words[0]["start"]
    end_time = words[-1]["end"]
    total_duration_minutes = (end_time - start_time) / 60.0

    # Calculate WPM by 60-second segments
    segment_duration = 60.0
    segments = []
    current_segment_start = start_time
    current_segment_words = 0

    for word in words:
        word_start = word["start"]

        # Check if we've moved to a new segment
        if word_start >= current_segment_start + segment_duration:
            # Save current segment
            if current_segment_words > 0:
                segments.append({
                    "start": current_segment_start,
                    "end": current_segment_start + segment_duration,
                    "wpm": current_segment_words
                })
            # Start new segment
            current_segment_start += segment_duration
            current_segment_words = 0

        current_segment_words += 1

    # Add final segment
    if current_segment_words > 0:
        segments.append({
            "start": current_segment_start,
            "end": end_time,
            "wpm": int(current_segment_words / ((end_time - current_segment_start) / 60.0)) if end_time > current_segment_start else current_segment_words
        })

    # Calculate overall WPM
    wpm_avg = len(words) / total_duration_minutes if total_duration_minutes > 0 else 0

    # Calculate WPM variance
    segment_wpms = [seg["wpm"] for seg in segments]
    wpm_variance_val = variance(segment_wpms) if len(segment_wpms) > 1 else 0

    # Detect pauses (gaps > 1 second between words)
    pauses = []
    for i in range(1, len(words)):
        gap = words[i]["start"] - words[i - 1]["end"]
        if gap > 1.0:
            pauses.append(gap)

    pause_count = len(pauses)
    pause_avg_duration = mean(pauses) if pauses else 0

    # Calculate pacing score (0-100)
    score = 100.0

    # Ideal WPM: 130-170
    if wpm_avg < 100:
        score -= (100 - wpm_avg) * 0.5  # Too slow
    elif wpm_avg > 200:
        score -= (wpm_avg - 200) * 0.3  # Too fast
    elif wpm_avg < 130:
        score -= (130 - wpm_avg) * 0.2  # Slightly slow
    elif wpm_avg > 170:
        score -= (wpm_avg - 170) * 0.2  # Slightly fast

    # Penalize high variance (inconsistent pacing)
    if wpm_variance_val > 400:
        score -= min(20, (wpm_variance_val - 400) / 50)

    # Bonus for natural pause distribution
    expected_pause_rate = total_duration_minutes * 0.5  # ~0.5 pauses per minute is natural
    pause_diff = abs(pause_count - expected_pause_rate)
    if pause_diff > 5:
        score -= min(10, pause_diff)

    score = max(0, min(100, score))

    return {
        "wpm_avg": round(wpm_avg, 1),
        "wpm_variance": round(wpm_variance_val, 1),
        "pause_count": pause_count,
        "pause_avg_duration": round(pause_avg_duration, 2),
        "pacing_score": round(score, 1),
        "pacing_timeline": segments
    }


def analyze_clarity(words: List[dict], transcript_text: str) -> dict:
    """
    Analyze clarity metrics including filler words and nonsensical words.

    Args:
        words: List of word objects
        transcript_text: Full transcript text

    Returns:
        dict with clarity metrics and score
    """
    if not words:
        return {
            "filler_word_count": 0,
            "filler_word_percentage": 0,
            "nonsensical_word_count": 0,
            "nonsensical_word_percentage": 0,
            "clarity_score": 0,
            "filler_words_breakdown": [],
            "nonsensical_words": []
        }

    total_words = len(words)

    # Count filler words
    filler_count_map = {}
    total_filler_count = 0

    for word_obj in words:
        word_lower = word_obj["word"].lower().strip()

        # Check single words
        if word_lower in FILLER_WORDS:
            filler_count_map[word_lower] = filler_count_map.get(word_lower, 0) + 1
            total_filler_count += 1

    # Check multi-word fillers in transcript text
    text_lower = transcript_text.lower()
    for filler in FILLER_WORDS:
        if " " in filler:
            count = len(re.findall(r'\b' + re.escape(filler) + r'\b', text_lower))
            if count > 0:
                filler_count_map[filler] = filler_count_map.get(filler, 0) + count
                total_filler_count += count

    filler_percentage = (total_filler_count / total_words * 100) if total_words > 0 else 0

    # Create breakdown
    filler_breakdown = [
        {"word": word, "count": count}
        for word, count in sorted(filler_count_map.items(), key=lambda x: x[1], reverse=True)
    ]

    # Detect nonsensical words using OpenAI
    nonsensical_words = []
    nonsensical_count = 0

    try:
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {
                    "role": "system",
                    "content": "You identify words that don't make sense in context or appear to be transcription errors."
                },
                {
                    "role": "user",
                    "content": f"""Identify words that don't make sense in context or appear to be transcription errors in this transcript.

Transcript:
{transcript_text}

Return a JSON object with a single key "nonsensical_words" containing an array of the problematic words. If there are none, return an empty array. Only include words that are clearly errors or nonsensical, not just uncommon terminology."""
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        result = json.loads(response.choices[0].message.content)
        nonsensical_words = result.get("nonsensical_words", [])
        nonsensical_count = len(nonsensical_words)

    except Exception as e:
        print(f"Error detecting nonsensical words: {e}")
        nonsensical_words = []
        nonsensical_count = 0

    nonsensical_percentage = (nonsensical_count / total_words * 100) if total_words > 0 else 0

    # Calculate clarity score (0-100)
    score = 100.0

    # Penalize filler words
    if filler_percentage < 2:
        pass  # Excellent
    elif filler_percentage < 5:
        score -= (filler_percentage - 2) * 5  # Good
    else:
        score -= 15 + (filler_percentage - 5) * 3  # Needs improvement

    # Penalize nonsensical words
    if nonsensical_percentage < 1:
        pass  # Excellent
    elif nonsensical_percentage < 3:
        score -= (nonsensical_percentage - 1) * 10
    else:
        score -= 20 + (nonsensical_percentage - 3) * 5

    score = max(0, min(100, score))

    return {
        "filler_word_count": total_filler_count,
        "filler_word_percentage": round(filler_percentage, 2),
        "nonsensical_word_count": nonsensical_count,
        "nonsensical_word_percentage": round(nonsensical_percentage, 2),
        "clarity_score": round(score, 1),
        "filler_words_breakdown": filler_breakdown,
        "nonsensical_words": nonsensical_words
    }


def grade_content_with_rubric(
    transcript_text: str,
    rubric: Rubric,
    criteria: List[RubricCriterion]
) -> dict:
    """
    Grade presentation content using OpenAI based on rubric criteria.

    Args:
        transcript_text: Full transcript text
        rubric: Rubric object
        criteria: List of RubricCriterion objects

    Returns:
        dict with criterion scores and overall feedback
    """
    if not criteria:
        return {
            "criterion_scores": [],
            "overall_feedback": "No rubric criteria available for grading."
        }

    # Build criteria description for prompt with IDs
    criteria_text = ""
    criteria_list = []
    for i, criterion in enumerate(criteria, 1):
        criteria_text += f"{i}. ID: {criterion.id}\n   Name: {criterion.name}\n   Max Score: {criterion.max_score} points\n   Weight: {criterion.weight}\n   Description: {criterion.description}\n\n"
        criteria_list.append({
            "id": criterion.id,
            "name": criterion.name,
            "max_score": criterion.max_score
        })

    prompt = f"""You are evaluating a presentation transcript based on this rubric.

Rubric: {rubric.name}
{rubric.description or ''}

Criteria:
{criteria_text}

Transcript:
{transcript_text}

For each criterion listed above, provide a score (0 to max_score) and 2-3 sentence feedback explaining the score.
Use the exact criterion ID from the list above in your response.
Also provide overall feedback (3-4 sentences) on the presentation.

Respond in JSON format with this exact structure:
{{
  "scores": [
    {{"criterion_id": "exact-id-from-above", "score": 4, "feedback": "Detailed feedback here..."}},
    ...
  ],
  "overall_feedback": "Overall feedback here..."
}}

IMPORTANT: Use the exact criterion IDs provided above (the UUID strings after "ID:")."""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert presentation evaluator. Provide fair, constructive feedback based on the rubric criteria."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.5
        )

        result = json.loads(response.choices[0].message.content)

        # Map criterion IDs to names and add max_score
        criterion_map = {c.id: c for c in criteria}
        criterion_scores = []
        scores_list = result.get("scores", [])

        # Try to match by criterion_id first, fallback to index matching
        for idx, score_obj in enumerate(scores_list):
            criterion_id = score_obj.get("criterion_id")
            criterion = None
            
            # Try exact ID match first
            if criterion_id and criterion_id in criterion_map:
                criterion = criterion_map[criterion_id]
            # Fallback: match by index if ID doesn't match
            elif idx < len(criteria):
                criterion = criteria[idx]
                criterion_id = criterion.id
            
            if criterion:
                criterion_scores.append({
                    "criterion_id": criterion_id,
                    "criterion_name": criterion.name,
                    "score": min(score_obj.get("score", 0), criterion.max_score),
                    "max_score": criterion.max_score,
                    "feedback": score_obj.get("feedback", "")
                })

        return {
            "criterion_scores": criterion_scores,
            "overall_feedback": result.get("overall_feedback", "")
        }

    except Exception as e:
        print(f"Error grading content with OpenAI: {e}")
        return {
            "criterion_scores": [],
            "overall_feedback": f"Error during grading: {str(e)}"
        }


def grade_presentation(grading_id: str, db: Session):
    """
    Main grading task that runs all analyses and updates the Grading record.

    Args:
        grading_id: ID of the Grading record
        db: Database session
    """
    try:
        # Load grading record
        grading = db.query(Grading).filter(Grading.id == grading_id).first()
        if not grading:
            print(f"Grading {grading_id} not found")
            return

        # Update status to processing
        grading.status = GradingStatus.processing
        db.commit()

        # Load transcript
        transcript = db.query(Transcript).filter(Transcript.id == grading.transcript_id).first()
        if not transcript:
            grading.status = GradingStatus.failed
            db.commit()
            print(f"Transcript not found for grading {grading_id}")
            return

        # Load rubric and criteria
        rubric = db.query(Rubric).filter(Rubric.id == grading.rubric_id).first()
        if not rubric:
            grading.status = GradingStatus.failed
            db.commit()
            print(f"Rubric not found for grading {grading_id}")
            return

        criteria = db.query(RubricCriterion).filter(
            RubricCriterion.rubric_id == rubric.id
        ).order_by(RubricCriterion.order_index).all()

        # Extract word timestamps
        words = transcript.word_timestamps.get("words", []) if transcript.word_timestamps else []

        # Run pacing analysis
        pacing_results = analyze_pacing(words)
        grading.pacing_wpm_avg = pacing_results["wpm_avg"]
        grading.pacing_wpm_variance = pacing_results["wpm_variance"]
        grading.pacing_pause_count = pacing_results["pause_count"]
        grading.pacing_score = pacing_results["pacing_score"]

        # Run clarity analysis
        clarity_results = analyze_clarity(words, transcript.text)
        grading.clarity_filler_word_count = clarity_results["filler_word_count"]
        grading.clarity_filler_word_percentage = clarity_results["filler_word_percentage"]
        grading.clarity_nonsensical_word_count = clarity_results["nonsensical_word_count"]
        grading.clarity_score = clarity_results["clarity_score"]

        # Run content grading
        content_results = grade_content_with_rubric(transcript.text, rubric, criteria)

        print(f"Content results: {len(content_results['criterion_scores'])} criterion scores")

        # Calculate overall score (weighted average)
        total_weighted_score = 0
        total_weight = 0

        for score_obj in content_results["criterion_scores"]:
            criterion_id = score_obj["criterion_id"]
            criterion = next((c for c in criteria if c.id == criterion_id), None)
            if criterion:
                weighted_score = score_obj["score"] * criterion.weight
                total_weighted_score += weighted_score
                total_weight += criterion.max_score * criterion.weight
                print(f"Criterion {criterion.name}: score={score_obj['score']}, weight={criterion.weight}, weighted={weighted_score}")

        # Calculate max possible score
        max_possible_score = sum(c.max_score * c.weight for c in criteria)

        # Calculate percentage score
        overall_score = (total_weighted_score / max_possible_score * 100) if max_possible_score > 0 else 0

        print(f"Total weighted score: {total_weighted_score}, Max possible: {max_possible_score}, Overall: {overall_score}%")

        grading.overall_score = round(overall_score, 1)
        grading.max_possible_score = max_possible_score

        # Store detailed results
        grading.detailed_results = {
            "criterion_scores": content_results["criterion_scores"],
            "filler_words": clarity_results["filler_words_breakdown"],
            "nonsensical_words": clarity_results["nonsensical_words"],
            "pacing_timeline": pacing_results["pacing_timeline"],
            "ai_feedback": content_results["overall_feedback"]
        }

        # Update status to completed
        grading.status = GradingStatus.completed
        db.commit()

        print(f"Grading {grading_id} completed successfully")

    except Exception as e:
        print(f"Error grading presentation {grading_id}: {e}")
        grading = db.query(Grading).filter(Grading.id == grading_id).first()
        if grading:
            grading.status = GradingStatus.failed
            db.commit()
