import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) throw new Error('invalid hex length');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { commitment } = await req.json();
    if (typeof commitment !== 'string' || !/^(0x)?[0-9a-fA-F]{64}$/.test(commitment)) {
      return new Response(JSON.stringify({ error: 'commitment must be 32-byte hex' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pkcs8Hex = Deno.env.get('ISSUER_PRIVKEY_PKCS8');
    if (!pkcs8Hex) {
      return new Response(JSON.stringify({ error: 'ISSUER_PRIVKEY_PKCS8 not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pkcs8 = hexToBytes(pkcs8Hex);
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8 as BufferSource,
      { name: 'Ed25519' },
      false,
      ['sign'],
    );

    const msg = hexToBytes(commitment);
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key, msg as BufferSource);
    const signature = '0x' + bytesToHex(new Uint8Array(sig));

    return new Response(JSON.stringify({ signature }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sign-commitment error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});