// FILE: apps/web/app/api/pay/confirm/route.ts
import { pool } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { id, txHash } = await req.json()

    await pool.query(
      "UPDATE payment_links SET status = 'paid' WHERE id = $1",
      [id]
    )

    // Log the transaction or handle any internal transfers here
    console.log(`[PAY] Invoice ${id} confirmed. Tx: ${txHash}`)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
