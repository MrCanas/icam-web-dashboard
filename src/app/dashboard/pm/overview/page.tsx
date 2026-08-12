import { redirect } from "next/navigation";

/** URL antigua del Overview de PM: ahora vive en la zona Dashboard. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const { snapshot } = await searchParams;
  redirect(
    snapshot
      ? `/dashboard/portfolio/pm-overview?snapshot=${encodeURIComponent(snapshot)}`
      : "/dashboard/portfolio/pm-overview",
  );
}
