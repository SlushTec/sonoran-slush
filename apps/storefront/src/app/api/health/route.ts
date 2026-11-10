export const dynamic = "force-static";
export function GET() {
  return Response.json({
    status: "scaffold",
    service: "storefront",
    live_commerce: false,
  });
}
