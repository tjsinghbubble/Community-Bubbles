import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../styles/theme';
import BubbleButton from '../../components/BubbleButton';
import { NavHeader } from '../../components/ScreenHeader';
import { API_URL } from '../../config/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Interests'>;
  route: RouteProp<AuthStackParamList, 'Interests'>;
};

interface CategoryItem {
  id: number;
  name: string;
  displayName: string;
  image: string | null;
  parentId: number | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 8;
const CARD_GAP = 8;
const TOTAL_GAPS = CARD_GAP * 2;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - TOTAL_GAPS) / 3);

const MIN_SELECTIONS = 3;
const MAX_SELECTIONS = 20;
const PROGRESS_STEP = 0.75;

const ALL_TAB_ID = -1;

export default function InterestsScreen({ navigation, route }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [parentCategories, setParentCategories] = useState<CategoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<number>(ALL_TAB_ID);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const { name, email, password, gender, dateOfBirth, profilePhotoUri } = route.params;
  const loadCategories = async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`${API_URL}/api/categories/flat`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data: CategoryItem[] = await res.json();
      const parents = data.filter(c => c.parentId === null);
      const subcategories = data.filter(c => c.parentId !== null);
      setParentCategories(parents);
      setCategories(subcategories);
    } catch (err) {
      console.error('[InterestsScreen] Failed to load categories:', err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const toggleInterest = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  const handleContinue = () => {
    if (selected.length >= MIN_SELECTIONS) {
      navigation.navigate('Guidelines', {
        name, email, password, gender, dateOfBirth,
        interests: selected,
        profilePhotoUri,
      });
    }
  };

  const filteredCategories = activeTab === ALL_TAB_ID
    ? categories
    : categories.filter(c => c.parentId === activeTab);

  const remaining = Math.max(0, MIN_SELECTIONS - selected.length);
  const canContinue = selected.length >= MIN_SELECTIONS;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader onBack={() => navigation.goBack()} />

      <View style={styles.progressContainer}>
        <View style={styles.progressTrack} />
        <View style={[styles.progressFill, { width: `${PROGRESS_STEP * 100}%` }]} />
      </View>

      <Text style={styles.title}>Tell us your interests</Text>
      <Text style={styles.subtitle}>Select at least 3 to continue</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#35A8F7" />
        </View>
      ) : fetchError ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Couldn't load interests. Please try again.</Text>
          <TouchableOpacity onPress={loadCategories} style={styles.retryButton} testID="button-retry-interests">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabStrip}
            contentContainerStyle={styles.tabStripContent}
            testID="scroll-category-tabs"
          >
            <TouchableOpacity
              style={[styles.tab, activeTab === ALL_TAB_ID && styles.tabActive]}
              onPress={() => setActiveTab(ALL_TAB_ID)}
              testID="tab-all"
            >
              <Text style={[styles.tabText, activeTab === ALL_TAB_ID && styles.tabTextActive]}>All</Text>
            </TouchableOpacity>
            {parentCategories.map(parent => (
              <TouchableOpacity
                key={parent.id}
                style={[styles.tab, activeTab === parent.id && styles.tabActive]}
                onPress={() => setActiveTab(parent.id)}
                testID={`tab-category-${parent.id}`}
              >
                <Text style={[styles.tabText, activeTab === parent.id && styles.tabTextActive]}>
                  {parent.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
          >
            {filteredCategories.map((category) => {
              const id = category.name;
              const isSelected = selected.includes(id);
              const imageSource = resolveMediaUrl(category.image);
              return (
                <View key={id} style={styles.cardWrapper}>
                  <TouchableOpacity
                    style={[styles.card, isSelected && styles.cardSelected]}
                    onPress={() => toggleInterest(id)}
                    activeOpacity={0.8}
                    testID={`button-interest-${id}`}
                  >
                    <View style={styles.cardInner}>
                      {imageSource ? (
                        <Image
                          source={{ uri: imageSource }}
                          style={styles.cardImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
                      )}
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          </View>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                  <Text
                    style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}
                    testID={`text-interest-${id}`}
                  >
                    {category.displayName}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.footer}>
        <BubbleButton
          title={canContinue ? 'Continue' : `Select ${remaining} more`}
          onPress={handleContinue}
          disabled={!canContinue}
          testID="button-continue"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  progressContainer: { height: 2, position: 'relative' },
  progressTrack: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#DDDDDD' },
  progressFill: { position: 'absolute', left: 0, height: 2, backgroundColor: '#35A8F7' },
  title: {
    fontSize: 16, fontWeight: '700', color: '#1E1F26',
    textAlign: 'center', marginTop: 16,
  },
  subtitle: {
    fontSize: 16, fontWeight: '500', color: '#4D4D4D',
    textAlign: 'center', marginTop: 34, marginBottom: 8,
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 15, color: '#4D4D4D', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, backgroundColor: '#35A8F7',
  },
  retryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  tabStrip: { flexGrow: 0, marginTop: 8 },
  tabStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#EAF5FE',
    borderColor: '#35A8F7',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: '#35A8F7',
  },
  scroll: { flex: 1 },
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingLeft: GRID_PADDING, paddingRight: GRID_PADDING,
    paddingTop: 0, paddingBottom: 120,
    gap: CARD_GAP,
  },
  cardWrapper: { width: CARD_SIZE, marginBottom: 4, alignItems: 'center' },
  card: {
    width: CARD_SIZE, height: CARD_SIZE,
    borderRadius: 24,
    borderWidth: 3, borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#35A8F7' },
  cardInner: {
    flex: 1, borderRadius: 21,
    overflow: 'hidden', backgroundColor: '#FFFFFF',
  },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { backgroundColor: '#E0E0E0' },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(53, 168, 247, 0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#35A8F7',
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 14, fontWeight: '600', color: '#4D4D4D', textAlign: 'center', marginTop: 6 },
  cardLabelSelected: { color: '#35A8F7' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 40, paddingBottom: 40, paddingTop: 16,
  },
});
