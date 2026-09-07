import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
  // validate local URL to prevent abuse
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1 });
    return NextResponse.json({ dataUrl, url });
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
