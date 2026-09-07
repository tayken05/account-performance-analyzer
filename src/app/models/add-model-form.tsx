"use client";

import { useActionState } from "react";
import { createModel, type CreateModelState } from "./actions";

const initialState: CreateModelState = {
  error: null,
  success: false,
};

export function AddModelForm() {
  const [state, formAction, pending] = useActionState(createModel, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-green-800" role="status">
          Model added.
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          type="text"
          name="display_name"
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        OnlyFans username
        <input
          type="text"
          name="onlyfans_username"
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        AdsPower profile ID
        <input
          type="text"
          name="adspower_profile_id"
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked />
        Active
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add model"}
      </button>
    </form>
  );
}
