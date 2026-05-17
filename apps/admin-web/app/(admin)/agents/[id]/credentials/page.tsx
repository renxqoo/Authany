import { redirect } from "next/navigation";

export default async function CredentialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/agents/${id}`);
}
