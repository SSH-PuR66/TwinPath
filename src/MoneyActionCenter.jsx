import { useState } from "react";
import { FileSpreadsheet, HeartHandshake } from "lucide-react";
import BenefitsRadar from "./BenefitsRadar";
import CsvImportPanel from "./CsvImportPanel";

export default function MoneyActionCenter(props) {
    const [view, setView] = useState("benefits");
    return <section className="money-action-center"><nav className="grow-tabs" aria-label="Money tools"><button type="button" className={view === "benefits" ? "active" : ""} onClick={() => setView("benefits")}><HeartHandshake size={18} /> Benefits</button><button type="button" className={view === "import" ? "active" : ""} onClick={() => setView("import")}><FileSpreadsheet size={18} /> Import</button></nav>{view === "benefits" ? <BenefitsRadar {...props} /> : <CsvImportPanel {...props} />}</section>;
}
