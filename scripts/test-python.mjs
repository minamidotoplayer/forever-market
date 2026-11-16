import { spawnSync } from "node:child_process";
const command = process.platform === "win32" ? "python" : "python3";
const result = spawnSync(
  command,
  ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
