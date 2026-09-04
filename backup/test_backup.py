import unittest
from datetime import datetime, timedelta, timezone
from backup import expired_keys


class RetentionTests(unittest.TestCase):
    def test_only_expired_job_archives_are_deleted(self):
        now = datetime(2026, 9, 4, tzinfo=timezone.utc)
        key = "video-education/database/20260801T030000Z-" + "a" * 32 + ".dump"
        old = (now - timedelta(days=15)).isoformat()
        self.assertEqual(expired_keys([
            {"Key": key, "LastModified": old},
            {"Key": "other/important.dump", "LastModified": old},
            {"Key": "video-education/database/manual.dump", "LastModified": old},
            {"Key": key.replace("a" * 32, "b" * 32), "LastModified": (now - timedelta(days=14)).isoformat()},
            {"Key": key.replace("a" * 32, "c" * 32), "LastModified": now.isoformat()},
        ], now, 14), [key])


if __name__ == "__main__":
    unittest.main()
