import { useState } from "react";
import {
    Bot,
    Cable,
    ChartNoAxesCombined,
    GraduationCap,
    Landmark,
    WalletCards,
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
    { id: "profit", label: "Profit plan", shortLabel: "Profit", icon: ChartNoAxesCombined },
    { id: "connections", label: "Connections", shortLabel: "Connect", icon: Landmark },
    { id: "wallet", label: "Approval wallet", shortLabel: "Wallet", icon: WalletCards },
    { id: "automations", label: "Automations", shortLabel: "Auto", icon: Bot },
    { id: "student", label: "Student perks", shortLabel: "Perks", icon: GraduationCap },
    { id: "connectors", label: "Connectors", shortLabel: "Apply", icon: Cable },
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
            <nav className="grow-tabs grow-workspace-tabs tp-rail" aria-label="Grow workspace">
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
                            <span className="grow-tab-label-full">{item.label}</span>
                            <span className="grow-tab-label-short">{item.shortLabel}</span>
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
                        onOpenWallet={() => setActiveTab("wallet")}
                    />
                )}

                {activeTab === "wallet" && (
                    <ExperimentBudget
                        householdId={householdId}
                        currentUserId={currentUserId}
                        privateMode={privateMode}
                        onOpenConnections={() => setActiveTab("connections")}
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
                        onOpenConnections={() => setActiveTab("connections")}
                        onOpenWallet={() => setActiveTab("wallet")}
                    />
                )}
            </div>
        </div>
    );
}
