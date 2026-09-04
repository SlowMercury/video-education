"""Create a verified private PostgreSQL dump, then prune this job's old dumps."""
import json
import os
import re
import subprocess
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

PREFIX = "video-education/database/"
KEY_PATTERN = re.compile(r"^video-education/database/\d{8}T\d{6}Z-[0-9a-f]{32}\.dump$")


def expired_keys(objects, now, retention_days):
    cutoff = now - timedelta(days=retention_days)
    return [item["Key"] for item in objects
            if KEY_PATTERN.fullmatch(item.get("Key", ""))
            and datetime.fromisoformat(item["LastModified"].replace("Z", "+00:00")) < cutoff]


def run(arguments, *, env=None, as_json=False):
    result = subprocess.run(arguments, env=env, capture_output=True, text=True, timeout=1800)
    if result.returncode:
        # Connection and storage credentials must never appear in job logs.
        raise RuntimeError(f"{arguments[0]} failed (exit {result.returncode})")
    return json.loads(result.stdout) if as_json and result.stdout.strip() else None


def main():
    for name in ("DATABASE_URL", "BUCKET", "ENDPOINT", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_DEFAULT_REGION"):
        if not os.environ.get(name):
            raise RuntimeError(f"Missing configuration: {name}")
    retention = int(os.environ.get("RETENTION_DAYS", "14"))
    if not 7 <= retention <= 365:
        raise RuntimeError("RETENTION_DAYS must be between 7 and 365")
    endpoint = os.environ["ENDPOINT"]
    if urlsplit(endpoint).scheme != "https":
        raise RuntimeError("Storage endpoint must use HTTPS")
    connection = urlsplit(os.environ["DATABASE_URL"])
    if connection.scheme not in ("postgres", "postgresql") or not connection.hostname:
        raise RuntimeError("Invalid database connection configuration")
    pg_env = {**os.environ, "PGHOST": connection.hostname, "PGPORT": str(connection.port or 5432),
              "PGDATABASE": unquote(connection.path.lstrip("/")), "PGUSER": unquote(connection.username or "postgres"),
              "PGPASSWORD": unquote(connection.password or ""), "PGCONNECT_TIMEOUT": "15"}
    if "sslmode" in parse_qs(connection.query):
        pg_env["PGSSLMODE"] = parse_qs(connection.query)["sslmode"][0]
    bucket = os.environ["BUCKET"]
    aws = ["aws", "--endpoint-url", endpoint]
    now = datetime.now(timezone.utc)
    key = f"{PREFIX}{now:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex}.dump"
    with tempfile.TemporaryDirectory(prefix="video-education-backup-") as directory:
        archive = Path(directory) / "database.dump"
        print("Creating PostgreSQL backup...", flush=True)
        run(["pg_dump", "--format=custom", "--no-owner", "--no-privileges", "--file", str(archive)], env=pg_env)
        archive.chmod(0o600)
        run(["pg_restore", "--list", str(archive)])
        size = archive.stat().st_size
        if not size:
            raise RuntimeError("Database dump is empty")
        run([*aws, "s3", "cp", str(archive), f"s3://{bucket}/{key}", "--only-show-errors", "--no-progress"])
        uploaded = run([*aws, "s3api", "head-object", "--bucket", bucket, "--key", key], as_json=True)
        if uploaded["ContentLength"] != size:
            raise RuntimeError("Uploaded backup size does not match")
        print(f"Backup uploaded and verified: {key} ({size} bytes)", flush=True)
        # AWS CLI paginates list-objects-v2 automatically. Prune only after a successful upload.
        listing = run([*aws, "s3api", "list-objects-v2", "--bucket", bucket, "--prefix", PREFIX], as_json=True)
        expired = expired_keys(listing.get("Contents") or [], now, retention)
        for start in range(0, len(expired), 1000):
            delete_file = Path(directory) / "expired.json"
            delete_file.write_text(json.dumps({"Objects": [{"Key": name} for name in expired[start:start + 1000]], "Quiet": True}))
            result = run([*aws, "s3api", "delete-objects", "--bucket", bucket, "--delete", f"file://{delete_file}"], as_json=True)
            if result and result.get("Errors"):
                raise RuntimeError("Could not remove an expired backup")
        print(f"Backup complete. Removed {len(expired)} expired dump(s); retention is {retention} days.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Backup failed: {type(error).__name__}: {error}" if isinstance(error, RuntimeError)
              else f"Backup failed: {type(error).__name__}", flush=True)
        raise SystemExit(1)
