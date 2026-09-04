import { bucket, defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "sfo" });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 5000 });
  const discussionBackups = bucket("discussion-backups", { region: "sjc" });
  const videoEducation = service("video-education", {
    source: github("SlowMercury/video-education", { checkSuites: false }),
    build: { builder: "RAILPACK" },
    start: "npm start",
    healthcheck: "/healthz",
    healthcheckTimeout: 60,
    replicas: { "sfo": 1 },
    deploy: { preDeployCommand: ["npm run migrate"], restartPolicyMaxRetries: 3 },
    env: { DATABASE_URL: preserve(), DISCUSSIONS_ENABLED: preserve(), NODE_ENV: preserve(), OWNER_DISPLAY_NAME: preserve(), OWNER_PASSWORD_HASH: preserve(), RATE_LIMIT_SECRET: preserve(), SITE_ORIGIN: preserve(), TRUST_RAILWAY_PROXY: preserve() },
  });
  const databaseBackups = service("database-backups", {
    source: github("SlowMercury/video-education", { checkSuites: false, rootDirectory: "/backup" }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/backup/**"] },
    start: "python3 /backup/backup.py",
    replicas: { "sfo": 1 },
    deploy: { cronSchedule: "0 3 * * *", restartPolicyType: "NEVER" },
    env: { AWS_ACCESS_KEY_ID: preserve(), AWS_DEFAULT_REGION: preserve(), AWS_SECRET_ACCESS_KEY: preserve(), BUCKET: preserve(), DATABASE_URL: preserve(), ENDPOINT: preserve(), RAILWAY_DOCKERFILE_PATH: preserve(), RETENTION_DAYS: preserve() },
  });

  return project("video-creation", {
    resources: [videoEducation, databaseBackups, Postgres, postgresVolume, discussionBackups],
  });
});
