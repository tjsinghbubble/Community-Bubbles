import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
};

export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: '#E1E3E8',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 40, style }: { size?: number; style?: any }) {
  return <SkeletonBlock width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function ExploreCardSkeleton() {
  return (
    <View style={skeletonStyles.exploreCard}>
      <SkeletonBlock width="100%" height={160} borderRadius={16} />
      <SkeletonBlock width="75%" height={12} borderRadius={6} style={{ marginTop: 10 }} />
      <SkeletonBlock width="50%" height={10} borderRadius={6} style={{ marginTop: 6 }} />
    </View>
  );
}

export function ExploreGridSkeleton() {
  return (
    <View style={skeletonStyles.exploreGrid}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ExploreCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function BubbleDetailsSkeleton() {
  return (
    <View style={skeletonStyles.detailContainer}>
      <SkeletonBlock width="100%" height={200} borderRadius={0} />
      <View style={skeletonStyles.detailBody}>
        <SkeletonBlock width="60%" height={22} borderRadius={8} style={{ marginBottom: 12 }} />
        <SkeletonBlock width="40%" height={14} borderRadius={6} style={{ marginBottom: 20 }} />
        <View style={skeletonStyles.row}>
          <SkeletonBlock width={80} height={32} borderRadius={16} />
          <SkeletonBlock width={80} height={32} borderRadius={16} style={{ marginLeft: 10 }} />
          <SkeletonBlock width={80} height={32} borderRadius={16} style={{ marginLeft: 10 }} />
        </View>
        <SkeletonBlock width="100%" height={1} borderRadius={0} style={{ marginVertical: 20 }} />
        <SkeletonBlock width="90%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="100%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="70%" height={14} borderRadius={6} style={{ marginBottom: 20 }} />
        <SkeletonBlock width="100%" height={1} borderRadius={0} style={{ marginVertical: 10 }} />
        <View style={skeletonStyles.row}>
          {[0, 1, 2].map((i) => (
            <SkeletonCircle key={i} size={36} style={{ marginRight: 8 }} />
          ))}
          <SkeletonBlock width={60} height={14} borderRadius={6} style={{ marginLeft: 4 }} />
        </View>
      </View>
    </View>
  );
}

export function EventDetailsSkeleton() {
  return (
    <View style={skeletonStyles.detailContainer}>
      <SkeletonBlock width="100%" height={220} borderRadius={0} />
      <View style={skeletonStyles.detailBody}>
        <SkeletonBlock width="75%" height={22} borderRadius={8} style={{ marginBottom: 12 }} />
        <View style={[skeletonStyles.row, { marginBottom: 16 }]}>
          <SkeletonBlock width={20} height={20} borderRadius={4} />
          <SkeletonBlock width="50%" height={14} borderRadius={6} style={{ marginLeft: 8 }} />
        </View>
        <View style={[skeletonStyles.row, { marginBottom: 16 }]}>
          <SkeletonBlock width={20} height={20} borderRadius={4} />
          <SkeletonBlock width="40%" height={14} borderRadius={6} style={{ marginLeft: 8 }} />
        </View>
        <View style={[skeletonStyles.row, { marginBottom: 20 }]}>
          <SkeletonBlock width={20} height={20} borderRadius={4} />
          <SkeletonBlock width="60%" height={14} borderRadius={6} style={{ marginLeft: 8 }} />
        </View>
        <SkeletonBlock width="100%" height={44} borderRadius={22} style={{ marginBottom: 20 }} />
        <SkeletonBlock width="100%" height={1} borderRadius={0} style={{ marginBottom: 16 }} />
        <SkeletonBlock width="90%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="100%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="65%" height={14} borderRadius={6} />
      </View>
    </View>
  );
}

export function BulletinPostSkeleton() {
  return (
    <View style={skeletonStyles.bulletinPost}>
      <View style={skeletonStyles.bulletinLeft} />
      <View style={skeletonStyles.bulletinContent}>
        <SkeletonBlock width={80} height={20} borderRadius={10} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="80%" height={16} borderRadius={6} style={{ marginBottom: 6 }} />
        <SkeletonBlock width="100%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
        <SkeletonBlock width="90%" height={12} borderRadius={6} style={{ marginBottom: 10 }} />
        <View style={skeletonStyles.row}>
          <SkeletonBlock width={60} height={10} borderRadius={6} />
          <SkeletonBlock width={40} height={10} borderRadius={6} style={{ marginLeft: 8 }} />
        </View>
      </View>
    </View>
  );
}

export function BulletinBoardSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {[0, 1, 2, 3].map((i) => (
        <BulletinPostSkeleton key={i} />
      ))}
    </View>
  );
}

export function UpcomingEventRowSkeleton() {
  return (
    <View style={skeletonStyles.upcomingCard}>
      <SkeletonBlock width="30%" height={10} borderRadius={6} style={{ marginBottom: 8 }} />
      <View style={skeletonStyles.upcomingInner}>
        <SkeletonBlock width={60} height={60} borderRadius={10} />
        <View style={skeletonStyles.upcomingInfo}>
          <SkeletonBlock width="70%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonBlock width="50%" height={12} borderRadius={6} style={{ marginBottom: 4 }} />
          <SkeletonBlock width="40%" height={12} borderRadius={6} />
        </View>
      </View>
    </View>
  );
}

export function UpcomingScreenSkeleton() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
      <SkeletonBlock width={100} height={16} borderRadius={6} style={{ marginBottom: 16 }} />
      {[0, 1, 2, 3].map((i) => (
        <UpcomingEventRowSkeleton key={i} />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  exploreGrid: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  exploreCard: {
    width: '47.5%',
    marginBottom: 20,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  detailBody: {
    padding: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletinPost: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bulletinLeft: {
    width: 4,
    backgroundColor: '#E1E3E8',
  },
  bulletinContent: {
    flex: 1,
    padding: 14,
  },
  upcomingCard: {
    marginBottom: 16,
  },
  upcomingInner: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  upcomingInfo: {
    flex: 1,
    marginLeft: 12,
  },
});
