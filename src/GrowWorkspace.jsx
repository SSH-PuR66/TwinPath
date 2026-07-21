import { useState } from "react";
import {
    Bot,
    Cable,
    ChartNoAxesCombined,
    GraduationCap,
    Landmark,
} from "lucide-react";
import ConnectorCenter from "./ConnectorCenter";
import ExperimentBudget from "./ExperimentBudget";
import FinancialConnectionsPanel from "./FinancialConnectionsPanel";
import FinancialHub from "./FinancialHub";
import OperationsControlPlane from "./OperationsControlPlane";
import OpportunityImporter from "./OpportunityImporter";
import ProfitabilityWorkspace from "./ProfitabilityWorkspace";
import StudentPerks from "./StudentPerks";

const growTabs = [
    { id: "profit", label: "Profit plan", icon: ChartNoAxesCombined },
    { id: "connections", label: "Connections", icon: Landmark },
    { id: "automations", label: "Automations", icon: Bot },
    { id: "student", label: "Student perks", icon: GraduationCap },
    { id: "connectors", label: "Connectors", icon: Cable },
];

export default function GrowWorkspace({
    householdId,
    currentUserId,
    transactions,
    privateMode,
    reducedMotion,
    onLogTransaction,
    onAddOpportunity,
    onImported,
}) {
    const [activeTab, setActiveTab] = useState("profit");

    return (
        <div className="grow-workspace">
            <nav className="grow-tabs" aria-label="Grow workspace">
                {growTabs.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            className={activeTab === item.id ? "active" : ""}
                            aria-current={activeTab === item.id ? "page" : undefined}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="grow-tab-panel" key={activeTab}>
                {activeTab === "profit" && (
                    <div className="page-stack">
                        <ProfitabilityWorkspace
                            householdId={householdId}
                            currentUserId={currentUserId}
                            transactions={transactions}
                            privateMode={privateMode}
                            reducedMotion={reducedMotion}
                            onLogTransaction={onLogTransaction}
                            onTrackRoute={onAddOpportunity}
                        />
                        <FinancialHub
                            privateMode={privateMode}
                            onLogTransaction={onLogTransaction}
                            onAddOpportunity={onAddOpportunity}
                        />
                    </div>
                )}

                {activeTab === "connections" && (
                    <FinancialConnectionsPanel
                        householdId={householdId}
                        currentUserId={currentUserId}
                        privateMode={privateMode}
                    />
                )}

                {activeTab === "automations" && (
                    <div className="page-stack">
                        <OperationsControlPlane
                            householdId={householdId}
                            currentUserId={currentUserId}
                            privateMode={privateMode}
                        />
                        <OpportunityImporter
                            householdId={householdId}
                            currentUserId={currentUserId}
                            onImported={onImported}
                        />
                        <ExperimentBudget
                            householdId={householdId}
                            currentUserId={currentUserId}
                            privateMode={privateMode}
                        />
                    </div>
                )}

                {activeTab === "student" && (
                    <StudentPerks
                        householdId={householdId}
                        currentUserId={currentUserId}
                        onTrack={onAddOpportunity}
                    />
                )}

                {activeTab === "connectors" && (
                    <ConnectorCenter
                        householdId={householdId}
                        currentUserId={currentUserId}
                    />
                )}
            </div>
        </div>
    );
}
