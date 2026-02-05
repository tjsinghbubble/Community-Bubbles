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
import { Ionicons } from '@expo/vector-icons';

interface ImageCarouselProps {
  images: string[];
  height?: number;
  fallbackImage?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ImageCarousel({
  images,
  height = 200,
  fallbackImage = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

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
      style={[styles.image, { height, width: SCREEN_WIDTH }]}
      resizeMode="cover"
    />
  );

  if (displayImages.length === 1) {
    return (
      <Image
        source={{ uri: displayImages[0] }}
        style={[styles.image, { height, width: SCREEN_WIDTH }]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.container, { height }]}>
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
              styles.paginationDot,
              index === activeIndex && styles.paginationDotActive,
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
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
});
