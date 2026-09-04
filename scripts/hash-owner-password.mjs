import { hashPassword } from '../src/security.mjs';
if (process.stdin.isTTY) {
  console.error('Pipe a password (16–256 characters) from your password manager into this script. It prints the hash for OWNER_PASSWORD_HASH.');
  process.exit(1);
}
let password = '';
for await (const chunk of process.stdin) {
  password += chunk;
  if (password.length > 258) throw new Error('Password is too long');
}
console.log(await hashPassword(password.replace(/\r?\n$/, '')));
