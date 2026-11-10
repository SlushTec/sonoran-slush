export const dynamic = "force-static";
export function GET() {
  return Response.json(
    {
      ready: false,
      reason: "Production integrations and release gates are incomplete.",
    },
    { status: 503 },
  );
}
