import { motion } from 'framer-motion';

interface BeLiveLoaderProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { fontSize: 18, underlineHeight: 2, gap: 1 },
  md: { fontSize: 32, underlineHeight: 3, gap: 2 },
  lg: { fontSize: 48, underlineHeight: 4, gap: 3 },
};

const letters = [
  { char: 'b', color: '#00b4d8' },
  { char: 'e', color: '#00b4d8' },
  { char: 'l', color: '#e85d04' },
  { char: 'i', color: '#e85d04' },
  { char: 'v', color: '#e85d04' },
  { char: 'e', color: '#e85d04' },
];

const BeLiveLoader = ({ size = 'lg' }: BeLiveLoaderProps) => {
  const { fontSize, underlineHeight, gap } = sizeMap[size];

  return (
    <motion.div
      className="flex flex-col items-center justify-center"
      style={{ gap: gap * 4 }}
      animate={{ scale: [1, 1.03, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="relative">
        {/* Letters */}
        <div className="flex" style={{ gap }}>
          {letters.map((l, i) => (
            <motion.span
              key={i}
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize,
                color: l.color,
                display: 'inline-block',
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 20,
                delay: i * 0.08,
              }}
            >
              {l.char}
            </motion.span>
          ))}
        </div>

        {/* Shimmer overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, black 40%, black 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 40%, black 60%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
        />

        {/* Glowing underline sweep */}
        <div className="relative overflow-hidden" style={{ height: underlineHeight, marginTop: 4, borderRadius: underlineHeight }}>
          <motion.div
            className="absolute inset-y-0"
            style={{
              width: '40%',
              background: 'linear-gradient(90deg, #00b4d8, #e85d04)',
              borderRadius: underlineHeight,
              boxShadow: '0 0 12px rgba(0,180,216,0.5), 0 0 12px rgba(232,93,4,0.5)',
            }}
            animate={{ left: ['-40%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default BeLiveLoader;
