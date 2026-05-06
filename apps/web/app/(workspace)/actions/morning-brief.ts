"use server";

import { getServerSupabase } from "@/lib/supabase-server";
import { requireTenantContext } from "@flow/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const briefIdSchema = z.string().uuid();

export async function markBriefViewed(briefId: string) {
  const parsed = briefIdSchema.safeParse(briefId);
  if (!parsed.success) {
    return { success: false, error: "Invalid brief ID" };
  }

  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const { error } = await supabase
    .from("morning_briefs")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", parsed.data)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("Failed to mark brief as viewed:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/(workspace)", "layout");
  return { success: true };
}
