import { NextRequest, NextResponse } from "next/server";

const PYTHON_API = process.env.PYTHON_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const res = await fetch(`${PYTHON_API}/pdf/${jobId}`);

  if (!res.ok) {
    return NextResponse.json(
      { error: "PDF not found" },
      { status: res.status }
    );
  }

  const pdfBuffer = await res.arrayBuffer();
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=lego-mosaic-${jobId.slice(0, 8)}.pdf`,
    },
  });
}
