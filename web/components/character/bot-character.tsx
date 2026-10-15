'use client';
import { useRef, type CSSProperties } from 'react';
import { compose } from '@/lib/character/compose';
import { serializeGenome, type BotGenome, type Cell } from '@/lib/character/genome';
import { cellIndex, useCharacterMotion, type CharacterState } from './character-idle';
import styles from './bot-character.module.css';

export type { CharacterState } from './character-idle';

type Props = {
  genome: BotGenome;
  /** Rendered width and height in px. Multiples of 12 keep every cell on whole pixels. */
  size: number;
  /** CSS colour for accent cells, usually the bot's slot colour. */
  accent: string;
  state: CharacterState;
  label: string;
  /** Opt-in: eyes follow the pointer by up to half a cell. */
  lookAt?: boolean;
  className?: string;
};

function Rect({ c }: { c: Cell }) {
  return (
    <rect
      x={c.x}
      y={c.y}
      width={1}
      height={1}
      className={styles[c.part]}
      data-part={c.part}
      data-i={cellIndex(c.x, c.y)}
    />
  );
}

export function BotCharacter({ genome, size, accent, state, label, lookAt = false, className }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const key = serializeGenome(genome);
  // compose returns base, antenna, mouth, eye in paint order; the layers below keep that order.
  const cells = compose(genome);
  const of = (...parts: Cell['part'][]) => cells.filter((c) => parts.includes(c.part));
  const layers = { base: of('body', 'accent'), antenna: of('antenna'), mouth: of('mouth'), eye: of('eye') };
  const vars: CSSProperties & { '--bot-accent': string } = { '--bot-accent': accent };

  useCharacterMotion(ref, { state, lookAt, seed: `${key}|${label}` });

  return (
    <svg
      ref={ref}
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      data-state={state}
      className={className ? `${styles.bot} ${className}` : styles.bot}
      style={vars}
    >
      <g data-layer="figure">
        <g data-layer="base">
          {layers.base.map((c, i) => <Rect key={`b${i}`} c={c} />)}
        </g>
        <g data-layer="antenna">
          {layers.antenna.map((c, i) => <Rect key={`a${i}`} c={c} />)}
        </g>
        <g data-layer="mouth">
          {layers.mouth.map((c, i) => <Rect key={`m${i}`} c={c} />)}
        </g>
        <g data-layer="gaze">
          <g data-layer="lids">
            {layers.eye.map((c, i) => <Rect key={`e${i}`} c={c} />)}
          </g>
        </g>
      </g>
    </svg>
  );
}
