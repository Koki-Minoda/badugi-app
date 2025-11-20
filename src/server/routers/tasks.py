from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class TaskItem(BaseModel):
    id: str
    title: str
    status: str


@router.get("/", response_model=list[TaskItem])
def list_tasks():
    return [
        TaskItem(id="BUG-01", title="Negative stack fix", status="done"),
        TaskItem(id="BUG-20", title="Rating pipeline", status="in-progress"),
    ]
