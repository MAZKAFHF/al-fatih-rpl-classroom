import { NextResponse } from "next/server";
import { getAllLocalUrls, getPrimaryLocalIP } from "@/lib/network";

export async function GET() {
  const port = parseInt(process.env.PORT || "3000", 10);
  return NextResponse.json({
    primaryIp: getPrimaryLocalIP(),
    port,
    urls: getAllLocalUrls(port),
    host: `http://${getPrimaryLocalIP() || "localhost"}:${port}`,
  });
}
