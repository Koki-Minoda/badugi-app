from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class RLRecord(BaseModel):
    userId: str
    data: str
    timestamp: str


@router.post("/buffer")
def push_buffer(record: RLRecord):
    return {"status": "captured", "recordId": f"rl-{record.userId}-{record.timestamp}"}


@router.get("/buffer/stats")
def buffer_stats():
    return {"status": "ok", "records": 42, "lastUpdated": "2025-11-20T00:00:00Z"}
