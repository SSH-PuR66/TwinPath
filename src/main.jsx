import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import "./styles.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
            console.error("Service worker registration failed:", error);
        });
    });
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
