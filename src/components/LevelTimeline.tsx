import React from 'react';
import { User } from '../types';
import { LevelPoint } from '../utils/consistencyCalculator';

interface LevelTimelineProps {
  user: User;
  levelHistory: LevelPoint[];
}

const LEVEL_COLORS: Record<number, string> = {
  3: '#22c55e',  // green
  4: '#f59e0b',  // amber
  5: '#f97316',  // orange
};

const LEFT_MARGIN = 30;
const RIGHT_MARGIN = 10;
const TOP_MARGIN = 10;
const BOTTOM_MARGIN = 18;
const CHART_HEIGHT = 56;
const CELL_WIDTH = 22;
const SVG_HEIGHT = TOP_MARGIN + CHART_HEIGHT + BOTTOM_MARGIN;

// Y positions: L3 at top (best/goal), L5 at bottom (hardest/start)
const LEVEL_Y: Record<number, number> = {
  3: TOP_MARGIN + 5,
  4: TOP_MARGIN + Math.round(CHART_HEIGHT / 2),
  5: TOP_MARGIN + CHART_HEIGHT - 5,
};

const LevelTimeline: React.FC<LevelTimelineProps> = ({ user, levelHistory }) => {
  if (levelHistory.length === 0) return null;

  const numWeeks = levelHistory.length;
  const svgWidth = LEFT_MARGIN + numWeeks * CELL_WIDTH + RIGHT_MARGIN;

  const getX = (index: number) => LEFT_MARGIN + index * CELL_WIDTH + CELL_WIDTH / 2;
  const getY = (level: number) => LEVEL_Y[level] ?? LEVEL_Y[5];

  const lines: React.ReactNode[] = [];

  // Lead-in from left margin to first dot
  if (levelHistory.length > 0) {
    const firstX = getX(0);
    const firstY = getY(levelHistory[0].level);
    lines.push(
      <line key="lead" x1={LEFT_MARGIN} y1={firstY} x2={firstX} y2={firstY}
        stroke={LEVEL_COLORS[levelHistory[0].level]} strokeWidth={2} />
    );
  }

  // Step segments between each pair of weeks
  for (let i = 0; i < levelHistory.length; i++) {
    const point = levelHistory[i];
    const x = getX(i);
    const y = getY(point.level);
    const color = LEVEL_COLORS[point.level];

    if (i + 1 < levelHistory.length) {
      const nextX = getX(i + 1);
      const nextY = getY(levelHistory[i + 1].level);

      // Horizontal at current level to next week's x
      lines.push(
        <line key={`h-${i}`} x1={x} y1={y} x2={nextX} y2={y}
          stroke={color} strokeWidth={2} />
      );

      // Vertical transition if level changes
      if (y !== nextY) {
        lines.push(
          <line key={`v-${i}`} x1={nextX} y1={y} x2={nextX} y2={nextY}
            stroke="#d1d5db" strokeWidth={1.5} strokeDasharray="3,2" />
        );
      }
    } else {
      // Last point: extend line to right edge of its cell
      lines.push(
        <line key={`h-${i}`} x1={x} y1={y} x2={x + CELL_WIDTH / 2} y2={y}
          stroke={color} strokeWidth={2} />
      );
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={svgWidth}
        height={SVG_HEIGHT}
        style={{ display: 'block' }}
        aria-label={`Level history for ${user.name}`}
      >
        {/* Grid lines */}
        {[3, 4, 5].map(level => (
          <line
            key={`grid-${level}`}
            x1={LEFT_MARGIN}
            y1={getY(level)}
            x2={svgWidth - RIGHT_MARGIN}
            y2={getY(level)}
            stroke="#f3f4f6"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {[3, 4, 5].map(level => (
          <text
            key={`ylabel-${level}`}
            x={LEFT_MARGIN - 5}
            y={getY(level) + 4}
            textAnchor="end"
            fontSize={9}
            fill="#9ca3af"
          >
            L{level}
          </text>
        ))}

        {/* Step lines */}
        {lines}

        {/* Dots per week */}
        {levelHistory.map((point, i) => {
          const x = getX(i);
          const y = getY(point.level);
          const isCurrentWeek = i === levelHistory.length - 1;

          let dotFill: string;
          let dotStroke: string;

          if (isCurrentWeek) {
            dotFill = '#ffffff';
            dotStroke = '#9ca3af';
          } else if (point.isClean) {
            dotFill = '#22c55e';
            dotStroke = '#16a34a';
          } else {
            dotFill = '#ef4444';
            dotStroke = '#dc2626';
          }

          const tooltipText = isCurrentWeek
            ? `Week ${point.week}: Level ${point.level} (in progress)`
            : `Week ${point.week}: Level ${point.level} (${point.isClean ? 'clean' : 'missed'})`;

          return (
            <g key={`dot-${i}`}>
              <title>{tooltipText}</title>
              <circle
                cx={x}
                cy={y}
                r={isCurrentWeek ? 3.5 : 4}
                fill={dotFill}
                stroke={dotStroke}
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* X-axis: label every 4th week */}
        {levelHistory.map((point, i) => {
          if (point.week % 4 !== 0) return null;
          return (
            <text
              key={`xlabel-${i}`}
              x={getX(i)}
              y={SVG_HEIGHT - 2}
              textAnchor="middle"
              fontSize={9}
              fill="#9ca3af"
            >
              {point.week}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 px-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500"></span> Clean
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span> Missed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-white border border-gray-400"></span> In progress
        </span>
        <span className="flex items-center gap-3 ml-2">
          {[5, 4, 3].map(lvl => (
            <span key={lvl} className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5" style={{ background: LEVEL_COLORS[lvl] }}></span>
              L{lvl}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

export default LevelTimeline;
