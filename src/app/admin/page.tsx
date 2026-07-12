import { routeTrace } from "@/lib/route-trace";
import AdminPageV3 from "./page-v3";

export default async function AdminPage(props: Parameters<typeof AdminPageV3>[0]) {
  routeTrace("admin page entered");
  return <AdminPageV3 {...props} />;
}
