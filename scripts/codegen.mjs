import { spawnSync } from "node:child_process";

const schemaUrl = process.env.LEMIGAS_API_SCHEMA_URL ?? "http://localhost:3001/api/webapp-docs-json";
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["swagger-typescript-api", "generate", "-p", schemaUrl, "--module-name-first-tag", "-o", "./lib/api/generated", "-n", "api-generated.ts"], { stdio: "inherit", shell: process.platform === "win32" });

if (result.error) throw result.error;
process.exit(result.status ?? 1);
