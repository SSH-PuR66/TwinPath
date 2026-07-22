import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const PRODUCTION_CONTROL_PLANE_URL =
    "https://twinpath-control-plane.srodriguez46.workers.dev";

export default defineConfig(({ mode }) => {
    const fileEnv = loadEnv(mode, process.cwd(), "VITE_");

    const controlPlaneUrl =
        fileEnv.VITE_CONTROL_PLANE_URL ||
        process.env.VITE_CONTROL_PLANE_URL ||
        (mode === "production" ? PRODUCTION_CONTROL_PLANE_URL : "");

    return {
        plugins: [react()],
        define: {
            "import.meta.env.VITE_CONTROL_PLANE_URL":
                JSON.stringify(controlPlaneUrl),
        },
        build: {
            target: "es2020",
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react", "react-dom"],
                        supabase: ["@supabase/supabase-js"],
                        icons: ["lucide-react"],
                        motion: ["framer-motion"],
                    },
                },
            },
        },
    };
});
