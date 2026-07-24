import { useCallback } from "react";
import { safeExternalUrl } from "./safeUrl";
import { supabase } from "./supabase";

export const CONTROL_PLANE_TIMEOUT_MS = 8_000;

export async function readControlPlaneResponse(response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); }
    catch { return { message: text }; }
}

export function useControlPlane(householdId) {
    const baseUrl = (
        safeExternalUrl(String(import.meta.env.VITE_CONTROL_PLANE_URL || "").trim(), {
            allowLocalHttp: true,
        }) || ""
    ).replace(/\/+$/, "");

    const request = useCallback(async (path, options = {}) => {
        if (!baseUrl) throw new Error("TwinPath’s secure service is not configured for this deployment.");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.access_token) throw new Error("Sign in again to continue.");
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), CONTROL_PLANE_TIMEOUT_MS);
        let response;
        try {
            response = await fetch(`${baseUrl}${path}`, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${data.session.access_token}`,
                    "X-Household-Id": String(householdId),
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...options.headers,
                },
            });
        } catch (fetchError) {
            if (fetchError?.name === "AbortError") throw new Error("TwinPath took longer than 8 seconds to respond. Please retry or use CSV import.");
            throw fetchError;
        } finally {
            window.clearTimeout(timeout);
        }
        const payload = await readControlPlaneResponse(response);
        if (!response.ok) {
            throw new Error(payload.error?.message || payload.message || `Request failed (${response.status}).`);
        }
        return payload;
    }, [baseUrl, householdId]);

    return { request, configured: Boolean(baseUrl) };
}
