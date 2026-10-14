// HS256 keys for the local stack: the anon and service-role JWTs a Supabase
// project hands out, signed with the stack's own throwaway secret.
import { createHmac } from "node:crypto";
const secret = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "local", iat: 1700000000, exp: 2000000000, ...payload });
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
};
console.log(`export NEXT_PUBLIC_SUPABASE_ANON_KEY='${sign({ role: "anon" })}'`);
console.log(`export SUPABASE_SERVICE_ROLE_KEY='${sign({ role: "service_role" })}'`);
