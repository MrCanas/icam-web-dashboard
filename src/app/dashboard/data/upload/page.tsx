import DataUploadPage from "@/components/data/pages/DataUploadPage";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function Page() {
  await requireRouteAccess("data.upload");
  return <DataUploadPage />;
}
