/** Liveness/readiness probe target for the cluster deployment. */
export function GET() {
  return new Response("ok", { status: 200 });
}
