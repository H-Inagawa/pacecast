import { RunsView } from "./RunsView";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const params = await searchParams;
  const editId = params.edit ? Number(params.edit) : NaN;

  return <RunsView initialEditId={Number.isFinite(editId) ? editId : undefined} />;
}
