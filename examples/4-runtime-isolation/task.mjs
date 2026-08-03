// The task being run. It is identical in both cases: it tries to read a file.
import { readFileSync } from 'node:fs';
try {
  readFileSync('/etc/hosts', 'utf8');
  console.log('  task: disk read ALLOWED');
} catch (err) {
  console.log(`  task: disk read DENIED (${err.code})`);
}
