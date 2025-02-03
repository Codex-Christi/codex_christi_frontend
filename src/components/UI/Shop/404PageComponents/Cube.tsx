import { motion } from 'framer-motion';
import { FC } from 'react';

interface CubeProps {
  size?: number; // Cube size (default: 100)
  rotationSpeed?: number; // Speed of rotation (default: 10 seconds)
  borderColor?: string; // Neon border color (default: "#00FFFF")
  className?: string;
}

const Cube: FC<CubeProps> = ({
  size = 100,
  rotationSpeed = 10,
  borderColor = '#22d3ee',
  className,
}) => {
  return (
    <motion.div
      className={`absolute ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transformStyle: 'preserve-3d',
      }}
      animate={{ rotateX: 360, rotateY: 360 }}
      transition={{
        repeat: Infinity,
        duration: rotationSpeed,
        ease: 'linear',
      }}
    >
      {[
        'rotateY(0deg)',
        'rotateX(90deg)',
        'rotateY(180deg)',
        'rotateX(-90deg)',
        'rotateZ(90deg)',
        'rotateZ(-90deg)',
      ].map((rotation, i) => (
        <span
          key={i}
          className='absolute top-0 left-0 w-full h-full bg-transparent border-4'
          style={{
            borderColor: borderColor,
            transform: `${rotation} translateZ(${size / 2}px)`,
          }}
        />
      ))}
    </motion.div>
  );
};

export default Cube;
