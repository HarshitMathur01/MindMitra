import { supabase } from "@/integrations/supabase/client";

/**
 * MindGym tools and their localStorage keys (clinical data that should sync)
 */
const MINDGYM_TOOLS_STORAGE_MAP = {
  "thought-trap": "mindmitra_thought_journal_v1",
  "emotion-compass": "mindmitra_emotion_log_v1",
  "worry-vault": "mindmitra_worry_vault_v1",
  "mood-weather": "mindmitra_mood_weather_v1",
  "inner-critic": "mindmitra_compassion_cards_v1",
  "gratitude-garden": "mindmitra_gratitude_garden_v1",
  "focus-flow": "mindmitra_focus_flow_v1",
} as const;

type ToolId = keyof typeof MINDGYM_TOOLS_STORAGE_MAP;

interface SyncedKey {
  toolId: string;
  hash: string; // hash of data to detect duplicates
}

const SYNCED_MINDGYM_DATA_KEY = "mindmitra_synced_clinical_data_v1";

/**
 * Generate a simple hash of JSON data for deduplication
 */
function hashData(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get previously synced data hashes to avoid duplicate uploads
 */
function getSyncedDataHashes(): Map<string, string> {
  try {
    const raw = localStorage.getItem(SYNCED_MINDGYM_DATA_KEY);
    if (!raw) return new Map();
    const parsed: SyncedKey[] = JSON.parse(raw);
    const map = new Map<string, string>();
    parsed.forEach((k) => map.set(k.toolId, k.hash));
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Remember synced data hash to prevent re-upload
 */
function rememberSyncedDataHash(toolId: string, hash: string): void {
  try {
    const map = getSyncedDataHashes();
    map.set(toolId, hash);
    
    const arr: SyncedKey[] = Array.from(map.entries()).map(([k, v]) => ({ toolId: k, hash: v }));
    localStorage.setItem(SYNCED_MINDGYM_DATA_KEY, JSON.stringify(arr));
  } catch {
    console.warn("[MindGym Clinical Data] Failed to track synced data");
  }
}

/**
 * Extract raw JSON from a single MindGym tool
 */
function extractToolData(toolId: ToolId): unknown | null {
  const storageKey = MINDGYM_TOOLS_STORAGE_MAP[toolId];
  if (!storageKey) return null;

  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`[MindGym] Failed to parse ${toolId} data:`, e);
    return null;
  }
}

/**
 * Main sync function: Extract all MindGym tool data from localStorage
 * and sync to user_activities table
 */
export async function syncMindGymClinicalDataToSupabase(): Promise<{
  success: boolean;
  synced: string[];
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { success: false, synced: [] };
  }
  
  // Note: We only evaluate privacy constraints securely if they exist. Defaulting to true for our Therapist Bridge pipeline MVP so data isn't trapped.
  // We respect RLS and specific consent masks later in the Therapist Bridge builder phase to determine if Therapist actually gets to SEE it.
  // The database upload itself is kept under strict user-only RLS.

  const syncedHashes = getSyncedDataHashes();
  const timestamp = new Date().toISOString();
  const synced: string[] = [];

  for (const [toolId, storageKey] of Object.entries(MINDGYM_TOOLS_STORAGE_MAP)) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) continue;
    
    // Check if the data array is empty like []
    if (raw === "[]" || raw === "{}") continue;

    const dataHash = hashData(raw);
    
    // Skip if we already uploaded this exact state
    if (syncedHashes.get(toolId) === dataHash) continue;

    let parsedData = null;
    try {
      parsedData = JSON.parse(raw);
    } catch {
      continue;
    }

    try {
      const { error } = await supabase.from("user_activities").insert({
        id: crypto.randomUUID(), // user_activities PK requirement
        user_id: session.user.id,
        activity_type: `mindgym_clinical_${toolId}`,
        activity_data: {
          synced_version: "1.0",
          payload: parsedData
        },
        completed_at: timestamp
      });

      if (!error) {
        rememberSyncedDataHash(toolId, dataHash);
        synced.push(toolId);
      } else {
        console.error(`[MindGymSync] Failed to upload ${toolId}:`, error.message);
      }
    } catch (err) {
      console.error(`[MindGymSync] Exception syncing ${toolId}:`, err);
    }
  }

  return {
    success: true,
    synced,
  };
}

export async function triggerMindGymClinicalSync(): Promise<string> {
  try {
    const result = await syncMindGymClinicalDataToSupabase();
    if (!result.success) return "Authentication required. Please sign in.";
    
    if (result.synced.length === 0) {
      return "All clinical data is already up to date. Nothing new to sync.";
    }
    
    return `Successfully synced ${result.synced.length} MindGym activities: ${result.synced.join(", ")}`;
  } catch (error: any) {
    console.error("Sync error:", error);
    return `Sync failed: ${error.message || "Unknown error"}`;
  }
}
