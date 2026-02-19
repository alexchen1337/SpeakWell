from typing import Optional, List

from pydantic import BaseModel, Field


class GradingInitiateRequest(BaseModel):
    transcript_id: str
    rubric_id: str
    source_type: Optional[str] = None
    context_type: Optional[str] = None
    context_id: Optional[str] = None
    is_official: Optional[bool] = None


class GradingResponse(BaseModel):
    id: str
    transcriptId: str = Field(alias="transcriptId")
    audioFileId: Optional[str] = Field(alias="audioFileId")
    audioOwnerId: Optional[str] = Field(default=None, alias="audioOwnerId")
    presentationTitle: Optional[str] = Field(alias="presentationTitle")
    rubricId: Optional[str] = Field(alias="rubricId")
    rubricName: Optional[str] = Field(alias="rubricName")
    status: str
    overallScore: Optional[float] = Field(alias="overallScore")
    maxPossibleScore: Optional[float] = Field(alias="maxPossibleScore")
    sourceType: str = Field(default="self", alias="sourceType")
    contextType: str = Field(default="practice", alias="contextType")
    contextId: Optional[str] = Field(default=None, alias="contextId")
    contextName: Optional[str] = Field(default=None, alias="contextName")
    isOfficial: bool = Field(default=False, alias="isOfficial")
    pacingWpmAvg: Optional[float] = Field(alias="pacingWpmAvg")
    pacingWpmVariance: Optional[float] = Field(alias="pacingWpmVariance")
    pacingPauseCount: Optional[int] = Field(alias="pacingPauseCount")
    pacingScore: Optional[float] = Field(alias="pacingScore")
    clarityFillerWordCount: Optional[int] = Field(alias="clarityFillerWordCount")
    clarityFillerWordPercentage: Optional[float] = Field(alias="clarityFillerWordPercentage")
    clarityNonsensicalWordCount: Optional[int] = Field(alias="clarityNonsensicalWordCount")
    clarityScore: Optional[float] = Field(alias="clarityScore")
    detailedResults: Optional[dict] = Field(alias="detailedResults")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByName: Optional[str] = Field(default=None, alias="gradedByName")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True
