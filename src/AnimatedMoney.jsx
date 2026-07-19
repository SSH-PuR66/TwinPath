import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

const moneyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export function AnimatedMoney({ value, hidden = false }) {
    const motionValue = useMotionValue(0);

    const display = useTransform(motionValue, (current) =>
        moneyFormatter.format(current)
    );

    useEffect(() => {
        const controls = animate(motionValue, value, {
            duration: 0.65,
            ease: "easeOut",
        });

        return controls.stop;
    }, [motionValue, value]);

    if (hidden) return <span>••••••</span>;

    return <motion.span>{display}</motion.span>;
}
