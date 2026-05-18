import { AdminResourceDetailPage } from "@/components/admin/resource-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminResourceDetailPage id={id} resourceKey="keys" />;
}
