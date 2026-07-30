import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export default function NetworkStatus() {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        function goOnline() {
            setOnline(true);
        }

        function goOffline() {
            setOnline(false);
        }

        window.addEventListener("online", goOnline);
        window.addEventListener("offline", goOffline);

        return () => {
            window.removeEventListener("online", goOnline);
            window.removeEventListener("offline", goOffline);
        };
    }, []);

    if (online) return null;

    return (
        <div className="offline-banner" role="status">
            <CloudOff size={16} />
            <span>
                Offline. Previously loaded screens may remain visible, but changes
                cannot be saved.
            </span>
        </div>
    );
}
