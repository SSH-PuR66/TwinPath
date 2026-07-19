import { motion } from "framer-motion";

export function AnimatedPage({ children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{
                type: "spring",
                stiffness: 260,
                damping: 26,
            }}
        >
            {children}
        </motion.div>
    );
}
