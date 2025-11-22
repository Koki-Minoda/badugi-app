from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import time

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 30, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.buckets = {}

    async def dispatch(self, request: Request, call_next):
        now = time.time()
        key = request.client.host if request.client else "unknown"
        bucket = self.buckets.setdefault(key, [])
        bucket[:] = [ts for ts in bucket if ts + self.window_seconds > now]
        if len(bucket) >= self.max_requests:
            return JSONResponse({"detail": "Too many requests"}, status_code=429)
        bucket.append(now)
        response = await call_next(request)
        return response
