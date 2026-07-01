// deno-lint-ignore-file no-explicit-any
// @ts-ignore — Deno URL imports; run via Supabase edge runtime (Deno), not Node/tsc
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Flow:
//   1. Generate image via fal.ai FLUX.1-schnell
//   2. Download binary
//   3. Pin to IPFS via Pinata → permanent ipfs://CID URI
//
// Secrets (supabase secrets set KEY=value):
//   FAL_API_KEY   — fal.ai dashboard
//   PINATA_JWT    — pinata.cloud → API Keys → pinFileToIPFS scope

// @ts-ignore — Deno global
declare const Deno: { env: { get(key: string): string | undefined } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const falApiKey = Deno.env.get('FAL_API_KEY')
    const pinataJwt = Deno.env.get('PINATA_JWT')

    if (!falApiKey) {
      return new Response(
        JSON.stringify({ error: 'FAL_API_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    if (!pinataJwt) {
      return new Response(
        JSON.stringify({ error: 'PINATA_JWT not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // ── Step 1: Generate via fal.ai FLUX.1-schnell ───────────────────────────

    const enrichedPrompt = `avatar portrait, ${prompt.trim()}, square format, high quality, detailed`

    const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enrichedPrompt,
        image_size: 'square_hd',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!falRes.ok) {
      const errorText = await falRes.text()
      console.error('fal.ai error:', falRes.status, errorText)
      return new Response(
        JSON.stringify({ error: 'Image generation failed', details: errorText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }

    const falData = await falRes.json()
    const tempUrl: string = falData?.images?.[0]?.url
    if (!tempUrl) {
      return new Response(
        JSON.stringify({ error: 'No image returned from fal.ai' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }

    // ── Step 2: Download binary ───────────────────────────────────────────────

    const imgRes = await fetch(tempUrl)
    if (!imgRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to download generated image' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }
    const imgBlob = await imgRes.blob()

    // ── Step 3: Pin to IPFS via Pinata ────────────────────────────────────────

    const form = new FormData()
    form.append('file', imgBlob, 'avatar.webp')
    form.append('pinataMetadata', JSON.stringify({ name: `identizy-avatar-${Date.now()}` }))
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pinataJwt}` },
      body: form,
    })

    if (!pinataRes.ok) {
      const pinErr = await pinataRes.text()
      console.error('Pinata error:', pinataRes.status, pinErr)
      return new Response(
        JSON.stringify({ error: 'IPFS upload failed', details: pinErr }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }

    const pinataData = await pinataRes.json()
    const cid: string = pinataData.IpfsHash

    // ipfs:// URI is permanent — any gateway can resolve it
    return new Response(
      JSON.stringify({
        uri: `ipfs://${cid}`,
        gateway: `https://gateway.pinata.cloud/ipfs/${cid}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('generate-avatar error:', error)
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
