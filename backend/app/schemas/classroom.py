from typing import Optional, List

from pydantic import BaseModel, Field


class ClassroomCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class ClassroomResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    joinCode: str = Field(alias="joinCode")
    instructorId: str = Field(alias="instructorId")
    instructorName: Optional[str] = Field(alias="instructorName")
    instructorEmail: str = Field(alias="instructorEmail")
    studentCount: int = Field(alias="studentCount")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class StudentResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    enrolledAt: str = Field(alias="enrolledAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class JoinClassRequest(BaseModel):
    join_code: str = Field(..., min_length=1)


class PresentationResponse(BaseModel):
    id: str
    filename: str
    status: str
    duration: Optional[int]
    fileSize: Optional[int] = Field(alias="fileSize")
    uploadedAt: str = Field(alias="uploadedAt")
    studentId: str = Field(alias="studentId")
    studentName: Optional[str] = Field(alias="studentName")
    studentEmail: str = Field(alias="studentEmail")
    transcriptId: Optional[str] = Field(alias="transcriptId")
    latestGradingId: Optional[str] = Field(alias="latestGradingId")
    latestGradingStatus: Optional[str] = Field(alias="latestGradingStatus")
    latestGradingScore: Optional[float] = Field(alias="latestGradingScore")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")
    sourceType: Optional[str] = Field(default=None, alias="sourceType")
    contextType: Optional[str] = Field(default=None, alias="contextType")
    isOfficial: Optional[bool] = Field(default=None, alias="isOfficial")

    class Config:
        from_attributes = True
        populate_by_name = True


class ClassGradingResponse(BaseModel):
    id: str
    transcriptId: str = Field(alias="transcriptId")
    audioFileId: str = Field(alias="audioFileId")
    presentationTitle: str = Field(alias="presentationTitle")
    studentId: str = Field(alias="studentId")
    studentName: Optional[str] = Field(alias="studentName")
    studentEmail: str = Field(alias="studentEmail")
    rubricId: Optional[str] = Field(alias="rubricId")
    rubricName: Optional[str] = Field(alias="rubricName")
    status: str
    overallScore: Optional[float] = Field(alias="overallScore")
    pacingScore: Optional[float] = Field(alias="pacingScore")
    clarityScore: Optional[float] = Field(alias="clarityScore")
    gradedByUserId: Optional[str] = Field(default=None, alias="gradedByUserId")
    gradedByName: Optional[str] = Field(default=None, alias="gradedByName")
    gradedByRole: Optional[str] = Field(default=None, alias="gradedByRole")
    sourceType: str = Field(default="self", alias="sourceType")
    contextType: str = Field(default="practice", alias="contextType")
    isOfficial: bool = Field(default=False, alias="isOfficial")
    createdAt: str = Field(alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class ClassStatsResponse(BaseModel):
    totalPresentations: int = Field(alias="totalPresentations")
    gradedPresentations: int = Field(alias="gradedPresentations")
    officialGradings: int = Field(alias="officialGradings")
    averageScore: Optional[float] = Field(alias="averageScore")
    scoreDistribution: dict = Field(alias="scoreDistribution")

    class Config:
        from_attributes = True
        populate_by_name = True
