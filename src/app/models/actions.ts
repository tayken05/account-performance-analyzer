"use server";

import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";

export type CreateModelState = {
  error: string | null;
  success: boolean;
};

function readTrimmedField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function uniqueConstraintConflict(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  const constraint = candidate.constraint ?? "";
  const message = candidate.message ?? "";
  const isUniqueViolation =
    candidate.code === "23505" || message.includes("duplicate key");

  if (!isUniqueViolation) {
    return null;
  }

  if (
    constraint === "models_onlyfans_username_key" ||
    message.includes("models_onlyfans_username_key")
  ) {
    return "A model with this OnlyFans username already exists.";
  }

  if (
    constraint === "models_adspower_profile_id_key" ||
    message.includes("models_adspower_profile_id_key")
  ) {
    return "This AdsPower profile ID already belongs to another model.";
  }

  return "This model could not be added because it matches an existing record.";
}

export async function createModel(
  _previousState: CreateModelState,
  formData: FormData,
): Promise<CreateModelState> {
  const displayName = readTrimmedField(formData, "display_name");
  const onlyfansUsername = readTrimmedField(formData, "onlyfans_username");
  const adspowerProfileId = readTrimmedField(formData, "adspower_profile_id");
  const isActive = formData.get("is_active") === "on";

  if (!displayName) {
    return { error: "Display name is required.", success: false };
  }

  if (!onlyfansUsername) {
    return { error: "OnlyFans username is required.", success: false };
  }

  try {
    const sql = getSql();

    await sql`
      INSERT INTO models (
        display_name,
        onlyfans_username,
        adspower_profile_id,
        is_active
      )
      VALUES (
        ${displayName},
        ${onlyfansUsername},
        ${adspowerProfileId === "" ? null : adspowerProfileId},
        ${isActive}
      )
    `;
  } catch (error) {
    const conflictMessage = uniqueConstraintConflict(error);
    if (conflictMessage) {
      return { error: conflictMessage, success: false };
    }

    return { error: "The model could not be saved. Please try again.", success: false };
  }

  revalidatePath("/models");
  return { error: null, success: true };
}
