import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Rect, Line, Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'SlowCallTrends'>;
};

type Trend = {
  endpoint: string;
  method: string;
  count: number;
  avgMs: number;
  maxMs: number;
  date: string;
};

const CHART_PADDING_LEFT = 36;
const CHART_PADDING_RIGHT = 8;
const CHART_PADDING_TOP = 8;
const CHART_PADDING_BOTTOM = 32;
const OVERVIEW_CHART_HEIGHT = 140;
const ENDPOINT_CHART_HEIGHT = 160;
const MAX_ENDPOINTS_IN_CHART = 5;

const SERIES_COLORS = [
  '#35A8F7',
  '#F59E0B',
  '#FF6B6B',
  '#34C759',
  '#A78BFA',
];

function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function shortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length < 3) return date;
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function buildPoints(
  counts: number[],
  maxVal: number,
  plotWidth: number,
  plotHeight: number,
  barGap: number,
  paddingLeft: number,
  paddingTop: number,
): string {
  return counts
    .map((c, i) => {
      const x = paddingLeft + i * barGap + barGap / 2;
      const y = paddingTop + plotHeight - (maxVal > 0 ? (c / maxVal) * plotHeight : 0);
      return `${x},${y}`;
    })
    .join(' ');
}

export default function SlowCallTrendsScreen({ navigation }: Props) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchTrends = useCallback(async () => {
    try {
      setFetchError(false);
      const res = await apiService.getSlowCallTrends(30);
      setTrends(res?.trends ?? []);
      setGeneratedAt(res?.generatedAt ?? null);
    } catch (e) {
      console.warn('[SlowCallTrendsScreen] Failed to fetch slow-call trends:', e);
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTrends();
    }, [fetchTrends]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrends();
  };

  const last30Days = useMemo(() => getLast30Days(), []);

  const { dailyTotals, topEndpoints, endpointSeries, totalCount, isImproving } = useMemo(() => {
    const byDay: Record<string, number> = {};
    const byEndpoint: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
    const byEndpointByDay: Record<string, Record<string, number>> = {};

    for (const t of trends) {
      byDay[t.date] = (byDay[t.date] ?? 0) + t.count;

      const key = `${t.method} ${t.endpoint}`;
      if (!byEndpoint[key]) {
        byEndpoint[key] = { count: 0, avgMs: 0, maxMs: 0 };
      }
      const prevCount = byEndpoint[key].count;
      byEndpoint[key].count += t.count;
      byEndpoint[key].avgMs =
        prevCount + t.count > 0
          ? Math.round(
              (byEndpoint[key].avgMs * prevCount + t.avgMs * t.count) /
                byEndpoint[key].count,
            )
          : 0;
      byEndpoint[key].maxMs = Math.max(byEndpoint[key].maxMs, t.maxMs);

      if (!byEndpointByDay[key]) byEndpointByDay[key] = {};
      byEndpointByDay[key][t.date] = (byEndpointByDay[key][t.date] ?? 0) + t.count;
    }

    const dailyTotals = last30Days.map((date) => ({ date, count: byDay[date] ?? 0 }));

    const topEndpoints = Object.entries(byEndpoint)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, MAX_ENDPOINTS_IN_CHART)
      .map(([key, stats]) => ({ key, ...stats }));

    const endpointSeries = topEndpoints.map((ep) => ({
      key: ep.key,
      counts: last30Days.map((date) => byEndpointByDay[ep.key]?.[date] ?? 0),
    }));

    const totalCount = trends.reduce((sum, t) => sum + t.count, 0);

    const first15 = dailyTotals.slice(0, 15).reduce((s, d) => s + d.count, 0);
    const last15 = dailyTotals.slice(15).reduce((s, d) => s + d.count, 0);
    const isImproving = first15 > 0 && last15 < first15;

    return { dailyTotals, topEndpoints, endpointSeries, totalCount, isImproving };
  }, [trends, last30Days]);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - Spacing.md * 2 - Spacing.sm * 2;
  const plotWidth = chartWidth - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const barCount = last30Days.length;
  const barGap = plotWidth / barCount;

  const maxDailyTotal = Math.max(1, ...dailyTotals.map((d) => d.count));
  const overviewPlotHeight = OVERVIEW_CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const barWidth = Math.max(1, barGap * 0.65);

  const maxEndpointCount = Math.max(
    1,
    ...endpointSeries.flatMap((s) => s.counts),
  );
  const endpointPlotHeight = ENDPOINT_CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const yTicks = [0, Math.round(maxDailyTotal / 2), maxDailyTotal];
  const epYTicks = [0, Math.round(maxEndpointCount / 2), maxEndpointCount];
  const labelStep = Math.max(1, Math.floor(barCount / 6));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <NavHeader
        title="Slow-Call Trends"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.summaryBar} testID="slow-calls-summary-bar">
        <Ionicons name="speedometer-outline" size={16} color={Colors.text.secondary} />
        <Text style={styles.summaryText} testID="text-slow-call-summary">
          {totalCount === 0
            ? 'No slow calls recorded in the last 30 days'
            : `${totalCount} slow call${totalCount !== 1 ? 's' : ''} over 30 days  ·  ${
                isImproving ? '↓ improving' : '↑ worsening'
              }`}
        </Text>
      </View>

      {fetchError && !loading && (
        <View style={styles.fetchErrorBanner} testID="banner-fetch-error">
          <Ionicons name="alert-circle-outline" size={16} color={Colors.status.error} />
          <Text style={styles.fetchErrorText}>
            Could not load slow-call data. Pull down to try again.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator
          style={styles.loader}
          color={Colors.brand.primary}
          testID="loader-slow-calls"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.brand.primary}
            />
          }
          testID="scroll-slow-calls"
        >
          {totalCount === 0 ? (
            <View style={styles.emptyContainer} testID="container-empty">
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyText} testID="text-no-slow-calls">
                No slow calls recorded
              </Text>
              <Text style={styles.emptySubtext}>
                Slow API calls (over threshold) will appear here once recorded.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Daily Total (30 days)</Text>
                <View style={styles.chartCard} testID="chart-daily-totals">
                  <Svg width={chartWidth} height={OVERVIEW_CHART_HEIGHT}>
                    {yTicks.map((tick, i) => {
                      const y =
                        CHART_PADDING_TOP +
                        overviewPlotHeight -
                        (tick / maxDailyTotal) * overviewPlotHeight;
                      return (
                        <G key={`ytick-${i}`}>
                          <Line
                            x1={CHART_PADDING_LEFT}
                            y1={y}
                            x2={chartWidth - CHART_PADDING_RIGHT}
                            y2={y}
                            stroke={Colors.border.light}
                            strokeWidth={1}
                          />
                          <SvgText
                            x={CHART_PADDING_LEFT - 4}
                            y={y + 4}
                            fontSize={9}
                            fill={Colors.text.tertiary}
                            textAnchor="end"
                          >
                            {tick}
                          </SvgText>
                        </G>
                      );
                    })}

                    {dailyTotals.map((day, i) => {
                      const barH = Math.max(
                        0,
                        (day.count / maxDailyTotal) * overviewPlotHeight,
                      );
                      const x =
                        CHART_PADDING_LEFT + i * barGap + (barGap - barWidth) / 2;
                      const y = CHART_PADDING_TOP + overviewPlotHeight - barH;
                      const showLabel = i % labelStep === 0;
                      return (
                        <G key={`bar-${day.date}`}>
                          <Rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barH}
                            fill={Colors.brand.primary}
                            rx={2}
                            opacity={day.count === 0 ? 0.15 : 0.85}
                            testID={`bar-total-${day.date}`}
                          />
                          {showLabel && (
                            <SvgText
                              x={x + barWidth / 2}
                              y={CHART_PADDING_TOP + overviewPlotHeight + 16}
                              fontSize={8}
                              fill={Colors.text.tertiary}
                              textAnchor="middle"
                            >
                              {shortDate(day.date)}
                            </SvgText>
                          )}
                        </G>
                      );
                    })}
                  </Svg>
                </View>
              </View>

              {endpointSeries.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Per-Endpoint Trend (30 days)</Text>
                  <View style={styles.chartCard} testID="chart-per-endpoint">
                    <Svg width={chartWidth} height={ENDPOINT_CHART_HEIGHT}>
                      {epYTicks.map((tick, i) => {
                        const y =
                          CHART_PADDING_TOP +
                          endpointPlotHeight -
                          (tick / maxEndpointCount) * endpointPlotHeight;
                        return (
                          <G key={`epytick-${i}`}>
                            <Line
                              x1={CHART_PADDING_LEFT}
                              y1={y}
                              x2={chartWidth - CHART_PADDING_RIGHT}
                              y2={y}
                              stroke={Colors.border.light}
                              strokeWidth={1}
                            />
                            <SvgText
                              x={CHART_PADDING_LEFT - 4}
                              y={y + 4}
                              fontSize={9}
                              fill={Colors.text.tertiary}
                              textAnchor="end"
                            >
                              {tick}
                            </SvgText>
                          </G>
                        );
                      })}

                      {last30Days.map((date, i) => {
                        const showLabel = i % labelStep === 0;
                        const x = CHART_PADDING_LEFT + i * barGap + barGap / 2;
                        if (!showLabel) return null;
                        return (
                          <SvgText
                            key={`xlab-${date}`}
                            x={x}
                            y={CHART_PADDING_TOP + endpointPlotHeight + 16}
                            fontSize={8}
                            fill={Colors.text.tertiary}
                            textAnchor="middle"
                          >
                            {shortDate(date)}
                          </SvgText>
                        );
                      })}

                      {endpointSeries.map((series, si) => {
                        const color = SERIES_COLORS[si % SERIES_COLORS.length];
                        const points = buildPoints(
                          series.counts,
                          maxEndpointCount,
                          plotWidth,
                          endpointPlotHeight,
                          barGap,
                          CHART_PADDING_LEFT,
                          CHART_PADDING_TOP,
                        );
                        return (
                          <G key={`series-${series.key}`}>
                            <Polyline
                              points={points}
                              fill="none"
                              stroke={color}
                              strokeWidth={2}
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              opacity={0.9}
                              testID={`line-endpoint-${si}`}
                            />
                            {series.counts.map((c, i) => {
                              if (c === 0) return null;
                              const x = CHART_PADDING_LEFT + i * barGap + barGap / 2;
                              const y =
                                CHART_PADDING_TOP +
                                endpointPlotHeight -
                                (c / maxEndpointCount) * endpointPlotHeight;
                              return (
                                <Circle
                                  key={`dot-${si}-${i}`}
                                  cx={x}
                                  cy={y}
                                  r={2.5}
                                  fill={color}
                                  opacity={0.8}
                                />
                              );
                            })}
                          </G>
                        );
                      })}
                    </Svg>

                    <View style={styles.legend} testID="legend-endpoints">
                      {endpointSeries.map((series, si) => (
                        <View key={series.key} style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: SERIES_COLORS[si % SERIES_COLORS.length] },
                            ]}
                          />
                          <Text
                            style={styles.legendLabel}
                            numberOfLines={1}
                            testID={`legend-label-${si}`}
                          >
                            {series.key}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {topEndpoints.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Endpoint Summary</Text>
                  {topEndpoints.map((ep, i) => (
                    <View
                      key={ep.key}
                      style={styles.endpointCard}
                      testID={`card-endpoint-${i}`}
                    >
                      <View style={styles.endpointHeader}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] },
                          ]}
                        />
                        <Text
                          style={styles.endpointKey}
                          numberOfLines={1}
                          testID={`text-endpoint-key-${i}`}
                        >
                          {ep.key}
                        </Text>
                      </View>
                      <View style={styles.endpointStats}>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue} testID={`text-endpoint-count-${i}`}>
                            {ep.count}
                          </Text>
                          <Text style={styles.statLabel}>calls</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue} testID={`text-endpoint-avg-${i}`}>
                            {formatMs(ep.avgMs)}
                          </Text>
                          <Text style={styles.statLabel}>avg</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue} testID={`text-endpoint-max-${i}`}>
                            {formatMs(ep.maxMs)}
                          </Text>
                          <Text style={styles.statLabel}>max</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {generatedAt && (
            <Text style={styles.generatedAt} testID="text-generated-at">
              Data as of {new Date(generatedAt).toLocaleString()}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  summaryText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    flex: 1,
  },
  fetchErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background.errorTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.light,
  },
  fetchErrorText: {
    fontSize: Typography.sizes.sm,
    color: Colors.status.error,
    flex: 1,
  },
  loader: {
    marginTop: Spacing.xl,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartCard: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    ...CardShadow,
    overflow: 'hidden',
  },
  legend: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  endpointCard: {
    backgroundColor: Colors.background.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...CardShadow,
  },
  endpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  endpointKey: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    fontFamily: 'monospace',
    flex: 1,
    fontWeight: '500',
  },
  endpointStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: Typography.sizes.base,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  generatedAt: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
