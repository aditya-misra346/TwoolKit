import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // If this route is reached, the backend proxy rewrite was not active
  return NextResponse.json(
    {
      error:
        "High-fidelity server conversions require an active backend service. Automatic in-browser fallback has been enabled.",
      fallback: true,
    },
    { status: 503 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Jobs status check requires active backend." }, { status: 404 });
}
