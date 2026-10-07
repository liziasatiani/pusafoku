import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password) {
  process.stderr.write("Usage: node scripts/hash-password.mjs <password>\n");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
process.stdout.write(`scrypt$${salt.toString("hex")}$${hash.toString("hex")}\n`);
