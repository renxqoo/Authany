import { AdminV2ResourceDetailPage } from "@/features/admin-v2/resource-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminV2ResourceDetailPage id={id} resourceKey="target-connections" />;
}
