import AdminPageV3 from "./page-v3";

export default async function AdminPage(props: Parameters<typeof AdminPageV3>[0]) {
  console.info("[route-trace] admin page entered");
  return <AdminPageV3 {...props} />;
}
