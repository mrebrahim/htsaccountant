import View from "@/views/AdAccountDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <View id={Number(id)} />;
}
