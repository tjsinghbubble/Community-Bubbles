import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { getFallbackImage } from '../utils/categoryImages';

interface ImageCarouselProps {
  images: string[];
  height?: number;
  fallbackImage?: string | number;
  width?: number;
  borderRadius?: number;
  category?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ImageCarousel({
  images,
  height = 200,
  fallbackImage,
  width,
  borderRadius = 0,
  category,
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const imageWidth = width || SCREEN_WIDTH;

  const localFallback = fallbackImage ?? getFallbackImage(category);
  const resolvedImages = images.map(url => resolveMediaUrl(url) ?? localFallback);
  const displayImages: (string | number)[] = resolvedImages.length > 0 ? resolvedImages : [localFallback];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundedIndex = Math.round(index);
    if (roundedIndex !== activeIndex) {
      setActiveIndex(roundedIndex);
    }
  };

  const renderItem = ({ item }: { item: string | number }) => (
    <Image
      source={item}
      style={{ height, width: imageWidth }}
      contentFit="cover"
    />
  );

  if (displayImages.length === 1) {
    return (
      <View style={[{ borderRadius, overflow: 'hidden' as const }]}>
        <Image
          source={displayImages[0]}
          style={{ height, width: imageWidth }}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, borderRadius, overflow: 'hidden' as const }]}>
      <FlatList
        ref={flatListRef}
        data={displayImages}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, index) => index.toString()}
      />
      <View style={styles.pagination}>
        {displayImages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDash,
              index === activeIndex && styles.paginationDashActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  paginationDash: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  paginationDashActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
