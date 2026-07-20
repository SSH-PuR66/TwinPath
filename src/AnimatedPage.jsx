import { motion } from "framer-motion";

export default function AnimatedPage({
    children,
    reducedMotion = false,
    className = "",
}) {
    return (
        <motion.div
            className={className}
            initial={
                reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 10,
                        scale: 0.992,
                    }
            }
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
            }}
            transition={
                reducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 260,
                        damping: 27,
                        mass: 0.8,
                    }
            }
        >
            {children}
        </motion.div>
    );
}
