import { NextRequest, NextResponse } from "next/server";
import { getMosaicServiceUrl } from "@/lib/mosaicService";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const res = await fetch(`${getMosaicServiceUrl()}/pdf/${jobId}`);

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
