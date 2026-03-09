import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface ImageCarouselProps {
  images: string[];
  height?: number;
  fallbackImage?: string;
  width?: number;
  borderRadius?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ImageCarousel({
  images,
  height = 200,
  fallbackImage = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
  width,
  borderRadius = 0,
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const imageWidth = width || SCREEN_WIDTH;

  const displayImages = images.length > 0 ? images : [fallbackImage];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundedIndex = Math.round(index);
    if (roundedIndex !== activeIndex) {
      setActiveIndex(roundedIndex);
    }
  };

  const renderItem = ({ item }: { item: string }) => (
    <Image
      source={{ uri: item }}
      style={{ height, width: imageWidth }}
      resizeMode="cover"
    />
  );

  if (displayImages.length === 1) {
    return (
      <View style={[{ borderRadius, overflow: 'hidden' as const }]}>
        <Image
          source={{ uri: displayImages[0] }}
          style={{ height, width: imageWidth }}
          resizeMode="cover"
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
  image: {
    backgroundColor: '#f0f0f0',
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
