import enum


class AudioStatus(enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class RubricType(enum.Enum):
    built_in = "built_in"
    custom = "custom"


class GradingStatus(enum.Enum):
    processing = "processing"
    completed = "completed"
    failed = "failed"


class GradingSourceType(enum.Enum):
    """Who initiated the AI grading - student (self) or instructor."""
    self = "self"
    instructor = "instructor"


class GradingContextType(enum.Enum):
    """The context of the grading - practice or class assignment."""
    practice = "practice"
    class_assignment = "class"
