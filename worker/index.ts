interface Env {
  ISSUER_PRIVKEY_PKCS8: string; // set via: wrangler secret put ISSUER_PRIVKEY_PKCS8
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const arr = new Uint8Array(h.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const CORS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let commitment: string;
    try {
      ({ commitment } = await request.json<{ commitment: string }>());
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!commitment) {
      return new Response(JSON.stringify({ error: "commitment required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const pkcs8Bytes = hexToBytes(env.ISSUER_PRIVKEY_PKCS8);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Bytes,
      { name: "Ed25519" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      hexToBytes(commitment)
    );

    return new Response(
      JSON.stringify({ signature: bytesToHex(new Uint8Array(sig)) }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  },
};
