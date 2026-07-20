import { Loader2 } from "lucide-react";

export default function FeatureLoader({
    label = "Loading feature…",
}) {
    return (
        <div className="feature-loader" role="status">
            <Loader2 className="spin" size={25} />
            <span>{label}</span>
        </div>
    );
}
