from fastapi import APIRouter
from sqlalchemy.exc import SQLAlchemyError

from ..core import db
from ..core.db import check_db_connection
from ..models import User

router = APIRouter()


@router.get("/users")
def list_users():
    """Return all users if the database is reachable; otherwise, an empty list."""

    if not check_db_connection():
        return {"items": []}

    session = db.SessionLocal()
    try:
        users = session.query(User).all()
    except SQLAlchemyError:
        return {"items": []}
    finally:
        session.close()

    return {"items": [user.to_dict() for user in users]}
