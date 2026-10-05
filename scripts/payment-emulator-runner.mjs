import { spawnSync } from 'node:child_process';
for (const args of [['scripts/payment-rules.test.mjs'], ['--import', 'tsx', 'scripts/payment-emulator.test.ts'], ['scripts/shopping-emulator.test.mjs']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
