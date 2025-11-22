import argparse
import httpx

API_URL = "http://localhost:8000"
API_KEY = "spec21-secret-token"

parser = argparse.ArgumentParser(description="Codex CLI for syncing with Badugi backend")
parser.add_argument("action", choices=["pull", "push", "profile"], help="Action to perform")
args = parser.parse_args()
headers = {"x-api-key": API_KEY}

with httpx.Client(base_url=API_URL, headers=headers, timeout=10) as client:
    if args.action == "pull":
        resp = client.get("/sync/pull")
    elif args.action == "push":
        payload = {"historyEntry": {"kind": "codex-sync", "detail": "pushed"}, "timestamp": httpx.Timestamp.now().isoformat()}
        resp = client.post("/sync/push", json=payload)
    else:
        resp = client.get("/profile/")
    resp.raise_for_status()
    print(resp.json())
