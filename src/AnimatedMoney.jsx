import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export function AnimatedMoney({ value, hidden = false, reducedMotion = false }) {
    const motionValue = useMotionValue(0);

    const display = useTransform(motionValue, (current) =>
        moneyFormatter.format(current)
    );

    useEffect(() => {
        if (hidden || reducedMotion) {
            motionValue.set(Number(value) || 0);
            return undefined;
        }

        const controls = animate(motionValue, value, {
            duration: 0.65,
            ease: "easeOut",
        });

        return controls.stop;
    }, [hidden, motionValue, reducedMotion, value]);

    if (hidden) return <span>••••••</span>;

    return <motion.span>{display}</motion.span>;
}
