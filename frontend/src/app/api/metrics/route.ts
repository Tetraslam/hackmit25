import { NextResponse } from "next/server"

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
  const url = `${base.replace(/\/$/, "")}/metrics`
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ error: `Backend responded ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: "Backend unreachable", details: String(err) }, { status: 502 })
  }
}


