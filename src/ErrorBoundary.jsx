import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            failed: false,
            message: "",
        };
    }

    static getDerivedStateFromError(error) {
        return {
            failed: true,
            message: error?.message || "An unexpected error occurred.",
        };
    }

    componentDidCatch(error, information) {
        console.error("TwinPath application error:", error, information);
    }

    resetApp = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.failed) {
            return this.props.children;
        }

        return (
            <main className="fatal-error-screen">
                <section className="fatal-error-card">
                    <div className="fatal-error-icon">
                        <AlertTriangle size={28} />
                    </div>

                    <p className="eyebrow">TWINPATH</p>
                    <h1>Something went wrong</h1>

                    <p>
                        Your saved Supabase records were not erased. Reload the app and
                        try again.
                    </p>

                    {import.meta.env.DEV && (
                        <pre className="fatal-error-details">
                            {this.state.message}
                        </pre>
                    )}

                    <button
                        className="button primary"
                        type="button"
                        onClick={this.resetApp}
                    >
                        <RefreshCw size={17} />
                        Reload TwinPath
                    </button>
                </section>
            </main>
        );
    }
}
