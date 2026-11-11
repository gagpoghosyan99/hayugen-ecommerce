const crypto = require("crypto");
const argon2 = require("argon2");

const ARGON = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function verifyScrypt(password, packed) {
  const [salt, hash] = String(packed || "").split(":");
  if (!salt || !hash) return false;
  let prev;
  try {
    prev = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  const next = crypto.scryptSync(password, salt, 64);
  return prev.length === next.length && crypto.timingSafeEqual(prev, next);
}

async function verifyPassword(password, hash, algo) {
  if (!hash) return false;
  if (algo === "argon2id" || String(hash).startsWith("$argon2")) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
  return verifyScrypt(password, hash);
}

async function hashPassword(password) {
  return argon2.hash(password, ARGON);
}

module.exports = { sha256, verifyPassword, hashPassword };
