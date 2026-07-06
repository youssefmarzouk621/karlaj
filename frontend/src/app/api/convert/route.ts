import { NextRequest, NextResponse } from "next/server";
import { getMosaicServiceUrl } from "@/lib/mosaicService";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const res = await fetch(`${getMosaicServiceUrl()}/process`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: text },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
