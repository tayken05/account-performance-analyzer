import { connection } from "next/server";
import { getSql } from "@/lib/db";
import { AddModelForm } from "./add-model-form";

export const metadata = {
  title: "Models",
};

type ModelRow = {
  display_name: string;
  onlyfans_username: string;
  adspower_profile_id: string | null;
  is_active: boolean;
  created_at: string | Date;
};

function formatCreatedDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function loadModels() {
  const sql = getSql();
  const rows = await sql`
    SELECT
      display_name,
      onlyfans_username,
      adspower_profile_id,
      is_active,
      created_at
    FROM models
    ORDER BY created_at DESC
  `;

  return rows as ModelRow[];
}

export default async function ModelsPage() {
  await connection();

  let models: ModelRow[] = [];
  let loadError = false;

  try {
    models = await loadModels();
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Models</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Internal registry of creator accounts.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Add a model</h2>
        <AddModelForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Current models</h2>
        {loadError ? (
          <p className="text-sm text-red-700">Unable to load models.</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-zinc-600">No models have been added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-300">
                  <th className="py-2 pr-4 font-medium">Display name</th>
                  <th className="py-2 pr-4 font-medium">OnlyFans username</th>
                  <th className="py-2 pr-4 font-medium">AdsPower profile ID</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr
                    key={model.onlyfans_username}
                    className="border-b border-zinc-200"
                  >
                    <td className="py-2 pr-4">{model.display_name}</td>
                    <td className="py-2 pr-4">{model.onlyfans_username}</td>
                    <td className="py-2 pr-4">
                      {model.adspower_profile_id ?? "Not set"}
                    </td>
                    <td className="py-2 pr-4">
                      {model.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="py-2">{formatCreatedDate(model.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
