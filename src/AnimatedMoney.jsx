import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

const wholeMoneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

export function AnimatedMoney({
    value,
    hidden = false,
    reducedMotion = false,
    whole = false,
}) {
    const motionValue = useMotionValue(0);

    const display = useTransform(motionValue, (current) =>
        (whole ? wholeMoneyFormatter : moneyFormatter).format(current)
    );

    useEffect(() => {
        if (hidden || reducedMotion) {
            motionValue.set(Number(value) || 0);
            return undefined;
        }

        const controls = animate(motionValue, Number(value) || 0, {
            duration: 0.4,
            ease: "easeOut",
        });

        return controls.stop;
    }, [hidden, motionValue, reducedMotion, value]);

    if (hidden) return <span>••••••</span>;

    return <motion.span>{display}</motion.span>;
}
