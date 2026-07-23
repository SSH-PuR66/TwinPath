import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// Household-scoped feature flags, read directly from Supabase under RLS.
// Flags are written only by the control-plane Worker or the
// decide_agent_proposal RPC — never by the client.
export function useFeatureFlags(householdId) {
    const [flags, setFlags] = useState(new Map());
    const [loaded, setLoaded] = useState(false);

    const refresh = useCallback(async () => {
        if (!householdId) return;
        const { data, error } = await supabase
            .from("feature_flags")
            .select("flag_key,enabled,payload,updated_at")
            .eq("household_id", householdId)
            .limit(200);
        if (!error && Array.isArray(data)) {
            setFlags(new Map(data.map((row) => [row.flag_key, row])));
        }
        setLoaded(true);
    }, [householdId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const isEnabled = useCallback(
        (flagKey) => Boolean(flags.get(flagKey)?.enabled),
        [flags]
    );

    const flagPayload = useCallback(
        (flagKey) => flags.get(flagKey)?.payload ?? {},
        [flags]
    );

    return { isEnabled, flagPayload, refresh, loaded };
}
