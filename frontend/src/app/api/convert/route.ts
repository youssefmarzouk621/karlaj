import { NextRequest, NextResponse } from "next/server";

const PYTHON_API = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const res = await fetch(`${PYTHON_API}/process`, {
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
