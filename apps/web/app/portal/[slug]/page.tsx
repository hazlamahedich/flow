import { redirect } from 'next/navigation';

/**
 * Portal root → overview redirect.
 *
 * `/portal/{slug}` (no sub-segment) routes here. We redirect to the overview
 * page rather than rendering a separate index — the layout + overview fully
 * exercise the portal session, and 9-2 will add additional sub-routes
 * (`invoices`, `reports`, etc.).
 */
export default async function PortalSlugIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/portal/${slug}/overview`);
}
