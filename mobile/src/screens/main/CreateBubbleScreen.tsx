import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Switch,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { API_URL, GOOGLE_PLACES_API_KEY } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import cometChatService from '../../services/cometchat.service';
import apiService from '../../services/api.service';
import MultiImagePicker from '../../components/MultiImagePicker';
import { CalendarIcon, LocationPinIcon, RadioIcon, ChevronDownIcon, ChevronUpIcon, PeopleIcon } from '../../components/icons';
import LocationPickerModal from '../../components/LocationPickerModal';
import BubbleButton from '../../components/BubbleButton';
import {
  Colors,
  Spacing,
  Radius,
  Typography,
  RadioStyles,
  SwitchColors,
  ModalStyles,
} from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CategoryItem {
  id: number;
  name: string;
  displayName: string | null;
  icon: string | null;
  image: string | null;
  parentId: number | null;
  displayOrder: number;
  placeholderName: string | null;
  placeholderTagline: string | null;
  placeholderDescription: string | null;
}

interface CategoryGroup {
  id: number;
  name: string;
  displayName: string | null;
  header: string | null;
  icon: string | null;
  displayOrder: number;
  children: CategoryItem[];
}

type RuleEntry = {
  ruleId: number | null;
  name: string;
  description: string;
  level: 'app' | 'category' | 'bubble';
};

const FALLBACK_RULES: RuleEntry[] = [
  { ruleId: null, name: 'Be Respectful', description: 'Treat all members with kindness and courtesy.', level: 'bubble' },
  { ruleId: null, name: 'Stay On Topic', description: 'Keep posts relevant to the bubble\'s purpose.', level: 'bubble' },
  { ruleId: null, name: 'Have Fun', description: 'Be yourself and enjoy the community!', level: 'bubble' },
];

const PRIVACY_OPTIONS = [
  { value: 'Public', label: 'Public', subtitle: 'Anyone can discover and join' },
  { value: 'Request', label: 'Request to Join', subtitle: 'Admin approval required before joining' },
  { value: 'Private', label: 'Private', subtitle: 'Invite-only event' },
];

const STEP_TITLES = ['Create a Bubble', 'Bubble Details', 'Rules', 'Privacy & Settings', 'Preview'];

export default function CreateBubbleScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const scrollRef = useRef<FlatList>(null);

  const [step, setStep] = useState(0);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [category, setCategory] = useState('');
  const [selectedCategoryItem, setSelectedCategoryItem] = useState<CategoryItem | null>(null);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(15);
  const [images, setImages] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [ruleEntries, setRuleEntries] = useState<RuleEntry[]>([]);
  const [appRuleEntries, setAppRuleEntries] = useState<RuleEntry[]>([]);
  const [hiddenInheritedRuleIds, setHiddenInheritedRuleIds] = useState<number[]>([]);
  const [privacy, setPrivacy] = useState('Public');
  const [memberLimit, setMemberLimit] = useState('');
  const [campusOnly, setCampusOnly] = useState(false);

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [expandAbout, setExpandAbout] = useState(true);
  const [expandAttachments, setExpandAttachments] = useState(false);
  const [expandRules, setExpandRules] = useState(false);
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<number | null>(null);

  const sliderWidth = useRef(0);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_URL}/api/categories`, { headers });
        if (res.ok) {
          const data: CategoryGroup[] = await res.json();
          setCategoryGroups(data);
        }
      } catch (e) {
        console.error('Failed to fetch categories:', e);
      } finally {
        setCategoriesLoading(false);
      }
    };
    const fetchAppRules = async () => {
      try {
        const result = await apiService.getAppRules();
        if (result && result.length > 0) {
          const entries: RuleEntry[] = result.map((r: any) => {
            const ruleName = r.rule?.name || r.name || '';
            const ruleDesc = r.rule?.description || r.description || '';
            const ruleText = r.rule?.text || r.text || '';
            if (ruleName) return { ruleId: r.ruleId, name: ruleName, description: ruleDesc, level: 'app' as const };
            const dotIdx = ruleText.indexOf('. ');
            if (dotIdx > 0) return { ruleId: r.ruleId, name: ruleText.substring(0, dotIdx), description: ruleText.substring(dotIdx + 2), level: 'app' as const };
            return { ruleId: r.ruleId, name: ruleText, description: '', level: 'app' as const };
          });
          setAppRuleEntries(entries);
          setRuleEntries(entries);
        } else {
          setRuleEntries([...FALLBACK_RULES]);
        }
      } catch (e) {
        console.error('Failed to fetch app rules:', e);
        setRuleEntries([...FALLBACK_RULES]);
      }
    };
    fetchCategories();
    fetchAppRules();
  }, [token]);

  useEffect(() => {
    if (!selectedCategoryItem?.id) {
      const bubbleOnlyRules = ruleEntries.filter(r => r.level === 'bubble');
      setRuleEntries([...appRuleEntries, ...bubbleOnlyRules]);
      return;
    }
    const fetchCategoryRules = async () => {
      try {
        const result = await apiService.getCategoryRules(selectedCategoryItem.id);
        if (result && result.length > 0) {
          const catEntries: RuleEntry[] = result.map((r: any) => {
            const ruleName = r.rule?.name || r.name || '';
            const ruleDesc = r.rule?.description || r.description || '';
            const ruleText = r.rule?.text || r.text || '';
            if (ruleName) return { ruleId: r.ruleId, name: ruleName, description: ruleDesc, level: 'category' as const };
            const dotIdx = ruleText.indexOf('. ');
            if (dotIdx > 0) return { ruleId: r.ruleId, name: ruleText.substring(0, dotIdx), description: ruleText.substring(dotIdx + 2), level: 'category' as const };
            return { ruleId: r.ruleId, name: ruleText, description: '', level: 'category' as const };
          });
          const bubbleOnlyRules = ruleEntries.filter(r => r.level === 'bubble');
          setRuleEntries([...appRuleEntries, ...catEntries, ...bubbleOnlyRules]);
        } else {
          const bubbleOnlyRules = ruleEntries.filter(r => r.level === 'bubble');
          setRuleEntries([...appRuleEntries, ...bubbleOnlyRules]);
        }
      } catch (e) {
        console.error('Failed to fetch category rules:', e);
      }
    };
    fetchCategoryRules();
  }, [selectedCategoryItem?.id]);

  const selectedSubcategory = categoryGroups
    .flatMap(g => g.children)
    .find(c => (c.displayName || c.name) === category);

  const handleSliderLayout = (e: LayoutChangeEvent) => {
    sliderWidth.current = e.nativeEvent.layout.width;
  };

  const handleSliderTouch = (e: GestureResponderEvent) => {
    if (sliderWidth.current <= 0) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth.current));
    const val = Math.round(1 + ratio * 49);
    setRadiusMiles(val);
  };

  const sliderPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handleSliderTouch(e),
      onPanResponderMove: (e) => handleSliderTouch(e),
    })
  ).current;

  const isCampusVerified = user?.campusVerified && user?.campusId;

  const allRuleTexts = ruleEntries.map(r => `${r.name}. ${r.description}`);

  const handleLocationSelect = (location: { name: string; address: string; latitude?: number; longitude?: number; placeId?: string }) => {
    setLocationName(location.name);
    setLocationAddress(location.address);
    if (location.latitude != null) setLocationLat(String(location.latitude));
    if (location.longitude != null) setLocationLng(String(location.longitude));
    setShowLocationPicker(false);
  };

  const canGoNext = () => {
    switch (step) {
      case 0: return !!category;
      case 1: return !!title && !!description;
      case 2: return true;
      case 3: return !!privacy;
      case 4: return true;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < 4) {
      setStep(step + 1);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
      navigation.goBack();
    }
  };

  const openAddRule = () => {
    setEditingRuleIndex(null);
    setRuleName('');
    setRuleDescription('');
    setShowRuleModal(true);
  };

  const openEditRule = (index: number) => {
    const entry = ruleEntries[index];
    if (entry.level !== 'bubble') return;
    setEditingRuleIndex(index);
    setRuleName(entry.name);
    setRuleDescription(entry.description);
    setShowRuleModal(true);
  };

  const saveRule = () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) return;
    const trimmedDesc = ruleDescription.trim();
    if (editingRuleIndex !== null) {
      const updated = [...ruleEntries];
      updated[editingRuleIndex] = { ...updated[editingRuleIndex], name: trimmedName, description: trimmedDesc };
      setRuleEntries(updated);
    } else {
      setRuleEntries([{ ruleId: null, name: trimmedName, description: trimmedDesc, level: 'bubble' }, ...ruleEntries]);
    }
    setShowRuleModal(false);
    setRuleName('');
    setRuleDescription('');
  };

  const deleteRule = (index: number) => {
    const entry = ruleEntries[index];
    if (entry.level !== 'bubble' && entry.ruleId !== null) {
      setHiddenInheritedRuleIds(prev => [...prev, entry.ruleId!]);
    }
    setRuleEntries(ruleEntries.filter((_, i) => i !== index));
    if (expandedRuleIndex === index) {
      setExpandedRuleIndex(null);
    } else if (expandedRuleIndex !== null && expandedRuleIndex > index) {
      setExpandedRuleIndex(expandedRuleIndex - 1);
    }
  };

  const moveRuleUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...ruleEntries];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setRuleEntries(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index - 1);
    else if (expandedRuleIndex === index - 1) setExpandedRuleIndex(index);
  };

  const moveRuleDown = (index: number) => {
    if (index >= ruleEntries.length - 1) return;
    const updated = [...ruleEntries];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setRuleEntries(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index + 1);
    else if (expandedRuleIndex === index + 1) setExpandedRuleIndex(index);
  };

  const toggleRuleExpand = (globalIndex: number) => {
    setExpandedRuleIndex(expandedRuleIndex === globalIndex ? null : globalIndex);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/bubbles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          tagline: tagline || title,
          category,
          categoryId: selectedCategoryItem?.id || null,
          description,
          rules: allRuleTexts,
          privacy,
          coverImage: images.length > 0 ? images[0] : null,
          images,
          attachments,
          memberLimit: memberLimit && !isNaN(parseInt(memberLimit)) ? parseInt(memberLimit) : null,
          locationName: locationName || null,
          locationAddress: locationAddress || null,
          locationLat: locationLat || null,
          locationLng: locationLng || null,
          radiusMiles,
          campusId: campusOnly && isCampusVerified ? user?.campusId : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create bubble');
        setLoading(false);
        return;
      }

      try {
        const bubbleOnlyRules = ruleEntries.filter(r => r.level === 'bubble');
        for (let i = 0; i < bubbleOnlyRules.length; i++) {
          await apiService.addBubbleRule(data.id, bubbleOnlyRules[i].name, bubbleOnlyRules[i].description, i + 1).catch(err =>
            console.log('Failed to save bubble rule:', err)
          );
        }
        for (const ruleId of hiddenInheritedRuleIds) {
          await apiService.setBubbleRuleOverride(data.id, ruleId, true).catch(err =>
            console.log('Failed to save rule override:', err)
          );
        }
      } catch (ruleError) {
        console.log('Error saving bubble rules:', ruleError);
      }

      try {
        const groupType = privacy === 'Public' ? 'public' : 'private';
        await cometChatService.createGroup(data.id, title, groupType);
        try {
          await cometChatService.joinGroup(data.id, groupType);
        } catch (joinError: any) {
          console.log('Join group note:', joinError?.code || joinError);
        }
        try {
          await cometChatService.sendMessage(data.id, `Welcome to ${title}! 🎉`);
        } catch (msgError) {
          console.log('Welcome message not sent:', msgError);
        }
      } catch (chatError) {
        console.log('CometChat group creation error:', chatError);
      }

      setLoading(false);
      setSubmitSuccess(true);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to create bubble. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (submitSuccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successTopSection}>
            <Text style={styles.successTitle}>Thanks for submitting{'\n'}your bubble</Text>
            <Text style={styles.successSubtitle}>
              We'll look over the details and let you know when your bubble is live.
            </Text>
          </View>
          <View style={styles.successImageContainer}>
            <Image
              source={require('../../assets/images/bubble-submitted.png')}
              style={styles.successImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.successBottomSection}>
            <BubbleButton
              title="Finish"
              onPress={() => navigation.goBack()}
              testID="button-finish"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerBack} onPress={goBack}>
        <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{step === 4 ? title : STEP_TITLES[step]}</Text>
      <TouchableOpacity style={styles.headerCancel} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            i <= step && styles.progressSegmentActive,
          ]}
        />
      ))}
    </View>
  );

  const renderStepCategory = () => {
    if (categoriesLoading) {
      return (
        <View style={[styles.formSection, { alignItems: 'center', paddingTop: 60 }]}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      );
    }

    const allSubcategories = categoryGroups.flatMap(g => g.children);
    const cardWidth = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3;

    return (
      <View style={styles.formSection}>
        <Text style={styles.stepPrompt}>What category will your bubble be in?</Text>
        <View style={styles.categoryImageGrid}>
          {allSubcategories.map((sub) => {
            const label = sub.displayName || sub.name;
            const selected = category === label;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.categoryImageCard, { width: cardWidth }]}
                onPress={() => {
                  setCategory(selected ? '' : label);
                  setSelectedCategoryItem(selected ? null : sub);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.categoryImageWrapper, selected && styles.categoryImageWrapperSelected]}>
                  {sub.image ? (
                    <Image
                      source={{ uri: sub.image }}
                      style={styles.categoryImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.categoryImagePlaceholder}>
                      <Ionicons
                        name={(sub.icon || 'ellipse') as any}
                        size={28}
                        color={Colors.text.tertiary}
                      />
                    </View>
                  )}
                  {selected && (
                    <View style={styles.categoryImageOverlay}>
                      <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.categoryImageLabel, selected && styles.categoryImageLabelSelected]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStepDetails = () => (
    <View style={styles.formSection}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Title <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={selectedCategoryItem?.placeholderName || 'Ex: Corgi Fam'}
          placeholderTextColor={Colors.text.tertiary}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 60))}
          maxLength={60}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Tagline <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput
          style={styles.fieldInput}
          placeholder={selectedCategoryItem?.placeholderTagline || 'Meetup with other Corgi Parents near you'}
          placeholderTextColor={Colors.text.tertiary}
          value={tagline}
          onChangeText={(t) => setTagline(t.slice(0, 100))}
          maxLength={100}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Bubble Description <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          placeholder={selectedCategoryItem?.placeholderDescription || "Describe what your bubble is about..."}
          placeholderTextColor={Colors.text.tertiary}
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, 500))}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={500}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Location <Text style={styles.required}>*</Text></Text>
        <TouchableOpacity
          style={styles.locationTappableField}
          onPress={() => setShowLocationPicker(true)}
          activeOpacity={0.7}
        >
          <LocationPinIcon size={20} color={locationName ? Colors.brand.primary : Colors.text.tertiary} />
          <View style={styles.locationTappableContent}>
            <Text style={[styles.locationTappableText, !locationName && styles.locationTappablePlaceholder]} numberOfLines={1}>
              {locationName || 'Search location or enter address'}
            </Text>
            {locationAddress ? (
              <Text style={styles.locationTappableSubtext} numberOfLines={1}>{locationAddress}</Text>
            ) : null}
          </View>
          <Ionicons name="search" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
        {locationName ? (
          <TouchableOpacity
            style={styles.locationClearButton}
            onPress={() => {
              setLocationName('');
              setLocationAddress('');
              setLocationLat('');
              setLocationLng('');
            }}
          >
            <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
            <Text style={styles.locationClearText}>Clear location</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sliderSeparator} />

      <View style={styles.sliderSection}>
        <Text style={styles.sliderValueCentered}>{radiusMiles} miles</Text>
        <View
          style={styles.sliderTrackWrapper}
          onLayout={handleSliderLayout}
          {...sliderPanResponder.panHandlers}
        >
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((radiusMiles - 1) / 49) * 100}%` }]} />
          </View>
          <View
            style={[
              styles.sliderThumb,
              { left: `${((radiusMiles - 1) / 49) * 100}%` },
            ]}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add a Cover Photo <Text style={styles.optional}>(Strongly Recommended)</Text></Text>
        <MultiImagePicker
          images={images}
          onImagesChange={setImages}
          maxImages={1}
          addLabel="+ Add"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Add Attachments</Text>
        <MultiImagePicker
          images={attachments}
          onImagesChange={setAttachments}
          maxImages={5}
          acceptAllFiles
        />
      </View>

      {isCampusVerified && (
        <View style={styles.fieldGroup}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleLabelRow}>
                <Text style={{ fontSize: Typography.sizes.md }}>🎓</Text>
                <Text style={styles.toggleLabel}>Campus Only</Text>
              </View>
              <Text style={styles.helperText}>
                Only students from your campus can see and join
              </Text>
            </View>
            <Switch
              value={campusOnly}
              onValueChange={setCampusOnly}
              trackColor={{ false: SwitchColors.trackFalse, true: SwitchColors.trackTrue }}
              thumbColor={campusOnly ? SwitchColors.thumbTrue : SwitchColors.thumbFalse}
            />
          </View>
        </View>
      )}

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        apiKey={GOOGLE_PLACES_API_KEY}
      />
    </View>
  );

  const renderStepRules = () => {
    return (
      <View style={styles.formSection}>
        <TouchableOpacity style={styles.addRuleButton} onPress={openAddRule}>
          <View style={styles.addRuleDashedBorder}>
            <Ionicons name="add" size={20} color={Colors.brand.primary} />
            <Text style={styles.addRuleText}>Add Rule</Text>
          </View>
        </TouchableOpacity>

        {ruleEntries.map((entry, index) => {
          const isExpanded = expandedRuleIndex === index;
          const isInherited = entry.level !== 'bubble';
          return (
            <Swipeable
              key={`rule-${index}`}
              renderRightActions={() => (
                <TouchableOpacity
                  style={styles.swipeDeleteAction}
                  onPress={() => deleteRule(index)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.background.primary} />
                  <Text style={styles.swipeDeleteText}>{isInherited ? 'Hide' : 'Delete'}</Text>
                </TouchableOpacity>
              )}
              overshootRight={false}
            >
              <TouchableOpacity
                style={styles.ruleItem}
                onPress={() => toggleRuleExpand(index)}
                activeOpacity={0.7}
              >
                <View style={styles.ruleContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ruleText} numberOfLines={isExpanded ? undefined : 1}>{entry.name}</Text>
                      {entry.description ? <Text style={styles.ruleDescription} numberOfLines={isExpanded ? undefined : 1}>{entry.description}</Text> : null}
                    </View>
                  </View>
                  {isExpanded && (
                    <View style={styles.ruleActions}>
                      <TouchableOpacity
                        style={[styles.ruleActionButton, index === 0 && styles.ruleActionDisabled]}
                        onPress={() => moveRuleUp(index)}
                        disabled={index === 0}
                      >
                        <Ionicons name="arrow-up" size={16} color={index === 0 ? Colors.text.tertiary : Colors.brand.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ruleActionButton, index === ruleEntries.length - 1 && styles.ruleActionDisabled]}
                        onPress={() => moveRuleDown(index)}
                        disabled={index === ruleEntries.length - 1}
                      >
                        <Ionicons name="arrow-down" size={16} color={index === ruleEntries.length - 1 ? Colors.text.tertiary : Colors.brand.primary} />
                      </TouchableOpacity>
                      {!isInherited && (
                        <TouchableOpacity
                          style={styles.ruleActionButton}
                          onPress={() => openEditRule(index)}
                        >
                          <Ionicons name="pencil" size={16} color={Colors.brand.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.ruleActionButton, { borderColor: Colors.status.error }]}
                        onPress={() => deleteRule(index)}
                      >
                        <Ionicons name="trash-outline" size={16} color={Colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View style={styles.ruleDragHandle}>
                  <Ionicons name="menu" size={20} color={Colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        })}
      </View>
    );
  };

  const renderStepPrivacy = () => (
    <View style={styles.formSection}>
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Who Can See This Bubble? <Text style={styles.required}>*</Text></Text>
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          {PRIVACY_OPTIONS.map((opt) => {
            const selected = privacy === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[RadioStyles.card, selected && RadioStyles.cardSelected]}
                onPress={() => setPrivacy(opt.value)}
              >
                <RadioIcon size={20} selected={selected} active={true} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={RadioStyles.label}>{opt.label}</Text>
                  <Text style={RadioStyles.description}>{opt.subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Member Limit</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder='Ex: 20'
          placeholderTextColor={Colors.text.tertiary}
          value={memberLimit}
          onChangeText={(t) => setMemberLimit(t.replace(/[^0-9]/g, '').slice(0, 5))}
          keyboardType="number-pad"
          maxLength={5}
        />
        <Text style={styles.helperText}>Leave empty for unlimited</Text>
      </View>
    </View>
  );

  const renderStepPreview = () => (
    <View style={styles.formSection}>
      {images.length > 0 ? (
        <Image source={{ uri: images[0] }} style={styles.previewCoverImage} />
      ) : (
        <View style={[styles.previewCoverImage, styles.reviewCoverPlaceholder]}>
          <Ionicons name="image-outline" size={40} color={Colors.text.tertiary} />
        </View>
      )}

      <Text style={styles.previewTagline}>{tagline || title}</Text>

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandAbout(!expandAbout)}
      >
        <Text style={styles.previewSectionTitle}>About</Text>
        {expandAbout ? <ChevronUpIcon size={20} color={Colors.text.secondary} /> : <ChevronDownIcon size={20} color={Colors.text.secondary} />}
      </TouchableOpacity>
      {expandAbout && (
        <Text style={styles.previewSectionBody}>{description}</Text>
      )}

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandAttachments(!expandAttachments)}
      >
        <Text style={styles.previewSectionTitle}>Attachments</Text>
        {expandAttachments ? <ChevronUpIcon size={20} color={Colors.text.secondary} /> : <ChevronDownIcon size={20} color={Colors.text.secondary} />}
      </TouchableOpacity>

      <View style={styles.previewDivider} />

      <View style={styles.previewMembersRow}>
        <View style={styles.reviewInfoRow}>
          <PeopleIcon size={18} color={Colors.text.primary} />
          <Text style={styles.previewMembersText}>{memberLimit || '0'} Members</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Members', `1 member\n\n• ${user?.name || 'You'} (Creator)`)}>
          <Text style={styles.previewViewLink}>view {'>'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.previewDivider} />

      <TouchableOpacity
        style={styles.previewSectionHeader}
        onPress={() => setExpandRules(!expandRules)}
      >
        <Text style={styles.previewSectionTitle}>Bubble Rules</Text>
        {expandRules ? <ChevronUpIcon size={20} color={Colors.text.secondary} /> : <ChevronDownIcon size={20} color={Colors.text.secondary} />}
      </TouchableOpacity>
      {expandRules && allRuleTexts.map((rule, i) => (
        <Text key={i} style={styles.reviewRuleItem}>{i + 1}. {rule}</Text>
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (step) {
      case 0: return renderStepCategory();
      case 1: return renderStepDetails();
      case 2: return renderStepRules();
      case 3: return renderStepPrivacy();
      case 4: return renderStepPreview();
      default: return null;
    }
  };

  const renderNextButton = () => {
    const isReview = step === 4;
    return (
      <View style={styles.bottomBar}>
        <BubbleButton
          title={isReview ? 'Submit for review' : 'Next'}
          onPress={isReview ? handleSubmit : goNext}
          disabled={!canGoNext()}
          loading={loading}
          testID={isReview ? 'button-submit-review' : 'button-next'}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderProgressBar()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={scrollRef}
          data={[{ key: 'form' }]}
          renderItem={() => renderStepContent()}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      </KeyboardAvoidingView>
      {renderNextButton()}

      <Modal
        visible={showRuleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRuleModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRuleModal(false)}
          >
            <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
              <TextInput
                style={[styles.fieldInput, styles.ruleModalInput]}
                placeholder="Rule name..."
                placeholderTextColor={Colors.text.tertiary}
                value={ruleName}
                onChangeText={setRuleName}
                autoFocus
              />
              <TextInput
                style={[styles.fieldInput, styles.ruleModalInput, { marginTop: 12 }]}
                placeholder="Description (optional)..."
                placeholderTextColor={Colors.text.tertiary}
                value={ruleDescription}
                onChangeText={setRuleDescription}
                multiline
              />
              <View style={styles.modalFooter}>
                <BubbleButton
                  title="Cancel"
                  onPress={() => setShowRuleModal(false)}
                  variant="outline"
                  style={{ flex: 1, height: 56 }}
                  testID="button-cancel-rule"
                />
                <BubbleButton
                  title="Save"
                  onPress={saveRule}
                  disabled={!ruleName.trim()}
                  style={{ flex: 1, height: 56 }}
                  testID="button-save-rule"
                />
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  headerBack: {
    padding: Spacing.xs,
    width: 60,
  },
  headerTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.md,
    textAlign: 'center',
    flex: 1,
  },
  headerCancel: {
    width: 60,
    alignItems: 'flex-end',
  },
  cancelText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.status.error,
    textDecorationLine: 'underline',
  },

  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 1.5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border.light,
  },
  progressSegmentActive: {
    backgroundColor: Colors.brand.primary,
  },

  content: {
    flex: 1,
  },
  formSection: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  fieldLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
  },
  required: {
    color: Colors.status.error,
  },
  optional: {
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.regular,
    fontSize: Typography.sizes.sm,
  },
  fieldInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.sizes.base,
    backgroundColor: Colors.background.primary,
    color: Colors.text.primary,
  },
  textArea: {
    height: undefined,
    minHeight: 120,
    paddingVertical: Spacing.lg,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },

  stepPrompt: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    textAlign: 'center',
  },
  categoryChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  categoryChipSelected: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  categoryChipText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.text.secondary,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: Typography.weights.semiBold,
  },

  locationTappableField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm + Spacing.xxs,
    paddingVertical: Spacing.sm + Spacing.xxs,
    backgroundColor: Colors.background.primary,
    gap: Spacing.sm,
  },
  locationTappableContent: {
    flex: 1,
  },
  locationTappableText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.medium,
  },
  locationTappablePlaceholder: {
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.regular,
  },
  locationTappableSubtext: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  locationClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    marginTop: Spacing.xxs,
    paddingVertical: Spacing.xxs,
  },
  locationClearText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },

  sliderSeparator: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.xs,
  },
  sliderSection: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  sliderValueCentered: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    fontWeight: Typography.weights.medium,
  },
  sliderTrackWrapper: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 3,
    backgroundColor: Colors.border.light,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.text.secondary,
    borderRadius: Radius.full,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.text.secondary,
    marginLeft: -10,
    top: 5,
  },
  coverPhotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: Colors.background.surface,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background.surface,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
    gap: Spacing.xxs,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },

  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background.card,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  ruleNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxs,
  },
  ruleNumberText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
  },
  ruleContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  ruleText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
  },
  ruleDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.sm,
    marginTop: 2,
  },
  ruleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
    alignSelf: 'flex-start',
    backgroundColor: Colors.background.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.xs,
  },
  ruleBadgeText: {
    fontSize: Typography.sizes.xxs,
    color: Colors.text.tertiary,
    fontWeight: Typography.weights.medium,
  },
  ruleActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  ruleActionButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.surface,
  },
  ruleActionDisabled: {
    opacity: 0.4,
  },
  swipeDeleteAction: {
    backgroundColor: Colors.status.error,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: Spacing.sm,
    gap: Spacing.xxs,
  },
  swipeDeleteText: {
    color: Colors.background.primary,
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
  },
  ruleDragHandle: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleSectionLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  ruleItemMandatory: {
    backgroundColor: Colors.background.secondary,
    opacity: 0.85,
  },
  ruleLockIcon: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRuleButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  addRuleDashedBorder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.primary,
    borderRadius: Platform.OS === 'ios' ? Radius.lg : 0,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  addRuleText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.primary,
  },


  reviewCoverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewRuleItem: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },

  previewCoverImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background.surface,
  },
  previewTagline: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
    lineHeight: Typography.lineHeight.base,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  previewSectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  previewSectionBody: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    paddingBottom: Spacing.md,
  },
  previewMembersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  previewMembersText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  previewViewLink: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.medium,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxxl : Spacing.xl,
    paddingTop: Spacing.lg,
  },
  primaryButton: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  successTopSection: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xxxl,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 32,
  },
  successSubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.base,
  },
  successImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successImage: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
  },
  successBottomSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxxl * 1.5 : Spacing.xxxl,
  },
  finishButton: {
    width: '100%',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: `rgba(0,0,0,${ModalStyles.overlay.opacity})`,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
  },
  ruleModalInput: {
    marginBottom: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.background.primary,
  },
  modalSecondaryText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
    letterSpacing: Typography.letterSpacing.tight,
  },

  categoryImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryImageCard: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryImageWrapperSelected: {
    borderColor: Colors.brand.primary,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl,
  },
  categoryImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.xl,
  },
  categoryImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(53, 168, 247, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryImageLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    marginTop: Spacing.xxs,
    textAlign: 'center',
    fontWeight: Typography.weights.bold,
  },
  categoryImageLabelSelected: {
    color: Colors.brand.primary,
    fontWeight: Typography.weights.bold,
  },
});
