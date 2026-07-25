import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useControlPlane } from "./useControlPlane";
import { Skeleton } from "./Skeleton";

const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

const VIEW_W = 360;
const VIEW_H = 246;
const TOP = 22;
const BAND = 200;
const NODE_W = 9;
const HUB_W = 11;
const SRC_X = 94;
const HUB_X = 175;
const DST_X = 257;
const LABEL_LEFT = 88;
const LABEL_RIGHT = 270;
const MIN_H = 12;
const GAP = 8;
const DRAW_FLAG = "twinpath-flowmap-drawn";

function short(label, limit = 15) {
    const text = String(label || "").trim();
    if (text.length <= limit) return text;
    return `${text.slice(0, limit - 1)}…`;
}

function layout(items, total) {
    const count = items.length;
    if (!count) return [];

    const totalGap = GAP * (count - 1);
    const usable = Math.max(BAND - totalGap, count * MIN_H);
    let heights = items.map((item) => Math.max(MIN_H, (item.value / total) * usable));
    const rawSum = heights.reduce((sum, height) => sum + height, 0);

    if (rawSum > usable) {
        const scale = usable / rawSum;
        heights = heights.map((height) => height * scale);
    }

    const used = heights.reduce((sum, height) => sum + height, 0) + totalGap;
    let cursor = TOP + Math.max(0, (BAND - used) / 2);

    return items.map((item, index) => {
        const height = heights[index];
        const node = { ...item, y: cursor, height, center: cursor + height / 2 };
        cursor += height + GAP;
        return node;
    });
}

function stackOnHub(nodes) {
    const span = nodes.reduce((sum, node) => sum + node.height, 0);
    let cursor = TOP + Math.max(0, (BAND - span) / 2);

    return nodes.map((node) => {
        const center = cursor + node.height / 2;
        cursor += node.height;
        return center;
    });
}

function ribbonPath(x1, y1, x2, y2) {
    const bend = (x2 - x1) * 0.45;
    return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
}

export default function MoneyFlowMap({ householdId, privateMode }) {
    const { request, configured } = useControlPlane(householdId);
    const [summary, setSummary] = useState(null);
    const [status, setStatus] = useState("loading");
    const [selected, setSelected] = useState(null);
    const prefersReducedMotion = useReducedMotion();

    const [shouldDraw] = useState(() => {
        try {
            if (sessionStorage.getItem(DRAW_FLAG) === "yes") return false;
            sessionStorage.setItem(DRAW_FLAG, "yes");
            return true;
        } catch (storageError) {
            return false;
        }
    });

    const load = useCallback(async () => {
        if (!configured) return;
        try {
            setSummary(await request("/v1/financial/summary"));
            setStatus("ready");
        } catch (loadError) {
            setStatus("error");
        }
    }, [configured, request]);

    useEffect(() => {
        load();
    }, [load]);

    const model = useMemo(() => {
        const income = Math.max(0, Number(summary?.income) || 0);
        const expense = Math.max(0, Number(summary?.expense) || 0);
        const total = Math.max(income, expense);

        const categories = (summary?.top_expense_categories || [])
            .slice(0, 5)
            .map((item) => ({
                id: `dst-${item.category}`,
                label: item.category,
                value: Math.max(0, Number(item.total) || 0),
            }))
            .filter((item) => item.value >= 1);

        const categorised = categories.reduce((sum, item) => sum + item.value, 0);
        const otherSpending = Math.max(0, expense - categorised);
        const fromSavings = Math.max(0, expense - income);
        const kept = Math.max(0, income - expense);

        const sources = [];
        if (income >= 1) sources.push({ id: "src-income", label: "Income", value: income });
        if (fromSavings >= 1) {
            sources.push({ id: "src-savings", label: "From savings", value: fromSavings });
        }

        const destinations = [...categories];
        if (otherSpending >= 1) {
            destinations.push({ id: "dst-other", label: "Other spending", value: otherSpending });
        }
        if (kept >= 1) destinations.push({ id: "dst-kept", label: "Kept", value: kept });

        return {
            income,
            expense,
            total,
            sources,
            destinations,
            windowDays: Number(summary?.window_days) || 90,
            flowCount: sources.length + destinations.length,
        };
    }, [summary]);

    const geometry = useMemo(() => {
        if (model.total <= 0) return null;

        const sourceNodes = layout(model.sources, model.total);
        const destNodes = layout(model.destinations, model.total);
        const hubLeft = stackOnHub(sourceNodes);
        const hubRight = stackOnHub(destNodes);

        const sourceSpan = sourceNodes.reduce((sum, node) => sum + node.height, 0);
        const destSpan = destNodes.reduce((sum, node) => sum + node.height, 0);
        const hubHeight = Math.max(sourceSpan, destSpan, MIN_H);
        const hubY = TOP + Math.max(0, (BAND - hubHeight) / 2);

        const ribbons = [
            ...sourceNodes.map((node, index) => ({
                id: `in-${node.id}`,
                touches: [node.id, "hub"],
                tone: "in",
                width: node.height,
                d: ribbonPath(SRC_X + NODE_W, node.center, HUB_X, hubLeft[index]),
            })),
            ...destNodes.map((node, index) => ({
                id: `out-${node.id}`,
                touches: ["hub", node.id],
                tone: "out",
                width: node.height,
                d: ribbonPath(HUB_X + HUB_W, hubRight[index], DST_X, node.center),
            })),
        ];

        return { sourceNodes, destNodes, ribbons, hubY, hubHeight };
    }, [model]);

    const showMoney = useCallback(
        (value) => (privateMode ? "••••••" : money.format(Math.abs(Number(value) || 0))),
        [privateMode],
    );

    const toggleNode = useCallback((id) => {
        setSelected((current) => (current === id ? null : id));
    }, []);

    const onNodeKeyDown = useCallback(
        (event, id) => {
            if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                event.preventDefault();
                toggleNode(id);
            }
        },
        [toggleNode],
    );

    if (!configured) return null;

    if (status === "loading") {
        return (
            <div className="money-flow-map" aria-label="Loading the money flow map">
                <Skeleton className="skeleton-hero" />
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="money-flow-map">
                <p className="money-flow-empty">
                    The money flow map needs the last 90 days of transactions, and they
                    could not be loaded right now. Everything else on this tab still works.
                </p>
            </div>
        );
    }

    const net = model.income - model.expense;
    const captionNode = selected
        ? [...model.sources, ...model.destinations].find((item) => item.id === selected)
        : null;
    const showDiagram = geometry && model.flowCount >= 3;

    return (
        <div
            className="money-flow-map"
            onKeyDown={(event) => {
                if (event.key === "Escape" && selected) {
                    event.stopPropagation();
                    setSelected(null);
                }
            }}
        >
            {showDiagram ? (
                <figure className="money-flow-figure">
                    <svg
                        className="flow-diagram"
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        role="img"
                        aria-label={`Money flow over the last ${model.windowDays} days. The same figures are listed below the diagram.`}
                    >
                        {geometry.ribbons.map((ribbon) => (
                            <motion.path
                                key={ribbon.id}
                                className="flow-ribbon"
                                data-tone={ribbon.tone}
                                data-dim={
                                    selected && !ribbon.touches.includes(selected) ? "yes" : "no"
                                }
                                d={ribbon.d}
                                strokeWidth={Math.max(2, ribbon.width)}
                                initial={shouldDraw && !prefersReducedMotion ? { pathLength: 0 } : false}
                                animate={{ pathLength: 1 }}
                                transition={{
                                    duration: shouldDraw && !prefersReducedMotion ? 0.6 : 0,
                                    ease: "easeOut",
                                }}
                            />
                        ))}

                        {geometry.sourceNodes.map((node) => (
                            <g
                                key={node.id}
                                className="flow-node"
                                role="button"
                                tabIndex={0}
                                aria-pressed={selected === node.id}
                                aria-label={`${node.label}, ${showMoney(node.value)} in`}
                                onClick={() => toggleNode(node.id)}
                                onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                            >
                                <rect
                                    className="flow-node-shape"
                                    data-tone="in"
                                    x={SRC_X}
                                    y={node.y}
                                    width={NODE_W}
                                    height={node.height}
                                    rx="3"
                                />
                                <text className="flow-label" x={LABEL_LEFT} y={node.center - 1} textAnchor="end">
                                    {short(node.label)}
                                </text>
                                <text className="flow-value" x={LABEL_LEFT} y={node.center + 8} textAnchor="end">
                                    {showMoney(node.value)}
                                </text>
                            </g>
                        ))}

                        {geometry.destNodes.map((node) => (
                            <g
                                key={node.id}
                                className="flow-node"
                                role="button"
                                tabIndex={0}
                                aria-pressed={selected === node.id}
                                aria-label={`${node.label}, ${showMoney(node.value)} out`}
                                onClick={() => toggleNode(node.id)}
                                onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                            >
                                <rect
                                    className="flow-node-shape"
                                    data-tone="out"
                                    x={DST_X}
                                    y={node.y}
                                    width={NODE_W}
                                    height={node.height}
                                    rx="3"
                                />
                                <text className="flow-label" x={LABEL_RIGHT} y={node.center - 1}>
                                    {short(node.label)}
                                </text>
                                <text className="flow-value" x={LABEL_RIGHT} y={node.center + 8}>
                                    {showMoney(node.value)}
                                </text>
                            </g>
                        ))}

                        <g
                            className="flow-node"
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected === "hub"}
                            aria-label={`Household, ${net >= 0 ? "kept" : "short"} ${showMoney(net)}`}
                            onClick={() => toggleNode("hub")}
                            onKeyDown={(event) => onNodeKeyDown(event, "hub")}
                        >
                            <rect
                                className="flow-hub-shape"
                                x={HUB_X}
                                y={geometry.hubY}
                                width={HUB_W}
                                height={geometry.hubHeight}
                                rx="4"
                            />
                            <text
                                className="flow-hub-label"
                                x={HUB_X + HUB_W / 2}
                                y={geometry.hubY - 6}
                                textAnchor="middle"
                            >
                                Household
                            </text>
                            <text
                                className="flow-value"
                                x={HUB_X + HUB_W / 2}
                                y={geometry.hubY + geometry.hubHeight + 13}
                                textAnchor="middle"
                            >
                                {net >= 0 ? "+" : "−"}
                                {showMoney(net)}
                            </text>
                        </g>
                    </svg>

                    <figcaption className="flow-caption">
                        {captionNode
                            ? `${captionNode.label} · ${showMoney(captionNode.value)}`
                            : selected === "hub"
                              ? `Everything passes through the household · ${showMoney(model.total)}`
                              : "Tap a block to follow one flow. Tap it again to clear."}
                    </figcaption>
                </figure>
            ) : (
                <p className="money-flow-empty">
                    There are not enough separate flows yet to draw a map — it would
                    look broken rather than useful. The figures are below.
                </p>
            )}

            <div className="flow-summary">
                <div className="flow-summary-row">
                    <span>Came in · last {model.windowDays} days</span>
                    <b>{showMoney(model.income)}</b>
                </div>

                {model.sources
                    .filter((item) => item.id !== "src-income")
                    .map((item) => (
                        <div className="flow-summary-row" key={item.id}>
                            <span>{item.label}</span>
                            <b>{showMoney(item.value)}</b>
                        </div>
                    ))}

                <div className="flow-summary-row">
                    <span>Went out</span>
                    <b>{showMoney(model.expense)}</b>
                </div>

                {model.destinations.map((item) => (
                    <div className="flow-summary-row" key={item.id}>
                        <span>{item.label}</span>
                        <b>{showMoney(item.value)}</b>
                    </div>
                ))}
            </div>

            <p className="flow-note">
                Sources are shown as one combined inflow. The bank feed does not say
                which account a deposit landed in, so income cannot be split per
                account here.
            </p>
        </div>
    );
}
