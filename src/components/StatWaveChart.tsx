import React from 'react';
import { View, StyleSheet, LayoutChangeEvent, Pressable } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import type { ThemeTokens } from '../theme';
import useThemedStyles from '../hooks/useThemedStyles';

interface StatWaveChartProps {
  data?: number[];
  labels?: string[];
  height?: number;
  selectedIndex?: number;
  onSelectIndex?: (index: number) => void;
  accentColor?: string;
  showLabels?: boolean;
  valueFormatter?: (val: number, idx: number) => string;
}

export default function StatWaveChart({
  data = [35, 55, 42, 78, 65, 88, 72],
  labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  height = 120,
  selectedIndex = 5,
  onSelectIndex,
  accentColor,
  showLabels = true,
  valueFormatter,
}: StatWaveChartProps) {
  const styles = useThemedStyles(makeStyles);
  const [containerWidth, setContainerWidth] = React.useState(320);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  const chartHeight = height - (showLabels ? 22 : 0);
  const paddingX = 14;
  const paddingY = 16;
  const usableWidth = Math.max(containerWidth - paddingX * 2, 100);
  const usableHeight = Math.max(chartHeight - paddingY * 2, 40);

  const maxVal = Math.max(...data, 100);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((val, idx) => {
    const x = paddingX + (idx / (data.length - 1)) * usableWidth;
    const y = paddingY + usableHeight - ((val - minVal) / range) * usableHeight;
    return { x, y, val };
  });

  // Generate smooth cubic bezier curve SVG path
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  // Area under curve for gradient fill
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
      : '';

  const lineColor = accentColor || styles.chartTokens.color;
  const gridColor = styles.gridLine.color;
  const labelColor = styles.labelText.color;
  const selectedPt = points[selectedIndex] ?? null;
  const selectedVal = selectedPt ? selectedPt.val : null;
  const formattedVal =
    selectedVal !== null
      ? valueFormatter
        ? valueFormatter(selectedVal, selectedIndex)
        : `${selectedVal}`
      : null;

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      <Svg width={containerWidth} height={height}>
        <Defs>
          <LinearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity={0.08} />
            <Stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>

        {/* Horizontal subtle guide lines */}
        <Line
          x1={paddingX}
          y1={paddingY}
          x2={containerWidth - paddingX}
          y2={paddingY}
          stroke={gridColor}
          strokeDasharray="3 3"
          strokeWidth={0.8}
        />
        <Line
          x1={paddingX}
          y1={paddingY + usableHeight / 2}
          x2={containerWidth - paddingX}
          y2={paddingY + usableHeight / 2}
          stroke={gridColor}
          strokeDasharray="3 3"
          strokeWidth={0.8}
        />
        <Line
          x1={paddingX}
          y1={paddingY + usableHeight}
          x2={containerWidth - paddingX}
          y2={paddingY + usableHeight}
          stroke={gridColor}
          strokeWidth={0.8}
        />

        {/* Gradient fill */}
        {areaD ? <Path d={areaD} fill="url(#waveGradient)" /> : null}

        {/* Line curve */}
        {pathD ? (
          <Path
            d={pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Vertical cursor indicator line for selected day */}
        {selectedPt ? (
          <Line
            x1={selectedPt.x}
            y1={paddingY}
            x2={selectedPt.x}
            y2={chartHeight}
            stroke="rgba(0, 0, 0, 0.15)"
            strokeDasharray="2 2"
            strokeWidth={1}
          />
        ) : null}

        {/* Data points */}
        {points.map((pt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <React.Fragment key={idx}>
              {isSelected ? (
                <>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={8}
                    fill="rgba(0, 0, 0, 0.08)"
                    onPress={() => onSelectIndex?.(idx)}
                  />
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill="#000000"
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    onPress={() => onSelectIndex?.(idx)}
                  />
                </>
              ) : (
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={2.5}
                  fill="#888888"
                  onPress={() => onSelectIndex?.(idx)}
                />
              )}

              {/* X Axis Labels */}
              {showLabels && labels[idx] ? (
                <SvgText
                  x={pt.x}
                  y={height - 4}
                  fontSize="9.5"
                  fontWeight={isSelected ? '600' : '400'}
                  fill={isSelected ? '#000000' : labelColor}
                  textAnchor="middle"
                  onPress={() => onSelectIndex?.(idx)}>
                  {labels[idx]}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}

        {/* Floating Tooltip Pill Badge above selected point */}
        {selectedPt && formattedVal ? (
          <>
            <Rect
              x={Math.max(6, Math.min(containerWidth - 54, selectedPt.x - 24))}
              y={Math.max(2, selectedPt.y - 20)}
              width={48}
              height={16}
              rx={8}
              fill="#000000"
            />
            <SvgText
              x={Math.max(6, Math.min(containerWidth - 54, selectedPt.x - 24)) + 24}
              y={Math.max(2, selectedPt.y - 20) + 11.5}
              fontSize="9"
              fontWeight="600"
              fill="#FFFFFF"
              textAnchor="middle">
              {formattedVal}
            </SvgText>
          </>
        ) : null}
      </Svg>

      {/* Invisible Interactive Pressable Columns for seamless tapping on mobile */}
      {onSelectIndex && (
        <View style={styles.touchOverlay} pointerEvents="box-none">
          <View style={styles.touchColumnsRow}>
            {points.map((_, idx) => (
              <Pressable
                key={idx}
                accessibilityRole="button"
                accessibilityLabel={labels[idx] || `Day ${idx + 1}`}
                style={styles.touchColumn}
                onPress={() => onSelectIndex(idx)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = ({ colors, fonts }: ThemeTokens) =>
  StyleSheet.create({
    container: {
      width: '100%',
      justifyContent: 'center',
      position: 'relative',
    },
    touchOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    touchColumnsRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    touchColumn: {
      flex: 1,
      height: '100%',
    },
    chartTokens: {
      color: colors.chartLine || '#000000',
    },
    chartGradientStart: {
      color: colors.chartGradientStart || 'rgba(0, 0, 0, 0.08)',
    },
    chartGradientEnd: {
      color: colors.chartGradientEnd || 'rgba(0, 0, 0, 0.00)',
    },
    gridLine: {
      color: '#EEEEF2',
    },
    labelText: {
      fontFamily: fonts.sans,
      color: '#999999',
    },
  });
