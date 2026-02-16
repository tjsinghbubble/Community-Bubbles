import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import MultiImagePicker from '../../components/MultiImagePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, RadioStyles, Gradients } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const PRIVACY_OPTIONS = [
  { value: 'Public', label: 'Public', subtitle: 'Anyone can discover and join' },
  { value: 'Request', label: 'Request to Join', subtitle: 'Admin approval required before joining' },
  { value: 'Private', label: 'Private', subtitle: 'Invite-only, hidden from explore' },
];

export default function EditBubbleScreen({ navigation, route }: Props) {
  const { bubble } = route.params as { bubble: any };

  const [title, setTitle] = useState(bubble.title || '');
  const [tagline, setTagline] = useState(bubble.tagline || '');
  const [category] = useState(bubble.category || '');
  const [description, setDescription] = useState(bubble.description || '');
  const [rules, setRules] = useState<string[]>(
    Array.isArray(bubble.rules) ? [...bubble.rules] : []
  );
  const [privacy, setPrivacy] = useState(bubble.privacy || 'Public');
  const [images, setImages] = useState<string[]>(
    Array.isArray(bubble.images) ? bubble.images : (bubble.coverImage ? [bubble.coverImage] : [])
  );
  const [attachments, setAttachments] = useState<string[]>(
    Array.isArray(bubble.attachments) ? [...bubble.attachments] : []
  );

  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [ruleText, setRuleText] = useState('');
  const [expandedRuleIndex, setExpandedRuleIndex] = useState<number | null>(null);

  const isFormValid = title && tagline && description;

  const openAddRule = () => {
    setEditingRuleIndex(null);
    setRuleText('');
    setShowRuleModal(true);
  };

  const openEditRule = (index: number) => {
    setEditingRuleIndex(index);
    setRuleText(rules[index]);
    setShowRuleModal(true);
  };

  const saveRule = () => {
    const trimmed = ruleText.trim();
    if (!trimmed) return;
    if (editingRuleIndex !== null) {
      const updated = [...rules];
      updated[editingRuleIndex] = trimmed;
      setRules(updated);
    } else {
      setRules([trimmed, ...rules]);
    }
    setShowRuleModal(false);
    setRuleText('');
  };

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
    if (expandedRuleIndex === index) {
      setExpandedRuleIndex(null);
    } else if (expandedRuleIndex !== null && expandedRuleIndex > index) {
      setExpandedRuleIndex(expandedRuleIndex - 1);
    }
  };

  const moveRuleUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...rules];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setRules(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index - 1);
    else if (expandedRuleIndex === index - 1) setExpandedRuleIndex(index);
  };

  const moveRuleDown = (index: number) => {
    if (index >= rules.length - 1) return;
    const updated = [...rules];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setRules(updated);
    if (expandedRuleIndex === index) setExpandedRuleIndex(index + 1);
    else if (expandedRuleIndex === index + 1) setExpandedRuleIndex(index);
  };

  const toggleRuleExpand = (index: number) => {
    setExpandedRuleIndex(expandedRuleIndex === index ? null : index);
  };

  const handleSave = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      await apiService.updateBubble(bubble.id, {
        title,
        tagline,
        category,
        description,
        rules,
        privacy,
        coverImage: images.length > 0 ? images[0] : null,
        images,
        attachments,
        campusId: bubble.campusId,
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update bubble. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Bubble</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {category ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryDisplay}>
                <Text style={styles.categoryDisplayText}>{category}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bubble Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Give your bubble a name"
              placeholderTextColor={Colors.neutral.coolMist}
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tagline *</Text>
            <TextInput
              style={styles.input}
              placeholder="A short description"
              placeholderTextColor={Colors.neutral.coolMist}
              value={tagline}
              onChangeText={setTagline}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people what this bubble is about..."
              placeholderTextColor={Colors.neutral.coolMist}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Community Rules</Text>

            <TouchableOpacity style={styles.addRuleButton} onPress={openAddRule}>
              <View style={styles.addRuleDashedBorder}>
                <Ionicons name="add" size={20} color={Colors.brand.primary} />
                <Text style={styles.addRuleText}>Add Rule</Text>
              </View>
            </TouchableOpacity>

            {rules.map((rule, index) => {
              const isExpanded = expandedRuleIndex === index;
              return (
                <Swipeable
                  key={`rule-${index}`}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDeleteAction}
                      onPress={() => deleteRule(index)}
                    >
                      <Ionicons name="trash-outline" size={20} color={Colors.background.primary} />
                      <Text style={styles.swipeDeleteText}>Delete</Text>
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
                      <Text style={styles.ruleText} numberOfLines={isExpanded ? undefined : 2}>{rule}</Text>
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
                            style={[styles.ruleActionButton, index === rules.length - 1 && styles.ruleActionDisabled]}
                            onPress={() => moveRuleDown(index)}
                            disabled={index === rules.length - 1}
                          >
                            <Ionicons name="arrow-down" size={16} color={index === rules.length - 1 ? Colors.text.tertiary : Colors.brand.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.ruleActionButton}
                            onPress={() => openEditRule(index)}
                          >
                            <Ionicons name="pencil" size={16} color={Colors.brand.primary} />
                          </TouchableOpacity>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyOptions}>
              {PRIVACY_OPTIONS.map((opt) => {
                const selected = privacy === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[RadioStyles.card, selected && RadioStyles.cardSelected]}
                    onPress={() => setPrivacy(opt.value)}
                  >
                    <View style={[RadioStyles.circle, selected && RadioStyles.circleSelected]}>
                      {selected && <View style={RadioStyles.innerDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={RadioStyles.label}>{opt.label}</Text>
                      <Text style={RadioStyles.description}>{opt.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Photos</Text>
            <MultiImagePicker
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              addLabel="+ Add Photos"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Attachments</Text>
            <MultiImagePicker
              images={attachments}
              onImagesChange={setAttachments}
              maxImages={5}
              acceptAllFiles
              addLabel="+ Add Attachments"
            />
          </View>

          <TouchableOpacity
            style={[(!isFormValid || loading) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!isFormValid || loading}
          >
            <LinearGradient
              colors={Gradients.button.colors as unknown as string[]}
              start={Gradients.button.start}
              end={Gradients.button.end}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator color={Colors.neutral.charcoal} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
                style={styles.ruleModalInput}
                placeholder="Enter your rule..."
                placeholderTextColor={Colors.text.tertiary}
                value={ruleText}
                onChangeText={setRuleText}
                autoFocus
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setShowRuleModal(false)}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveRule}
                  disabled={!ruleText.trim()}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={Gradients.button.colors as unknown as string[]}
                    start={Gradients.button.start}
                    end={Gradients.button.end}
                    style={[styles.gradientButton, !ruleText.trim() && { opacity: 0.5 }]}
                  >
                    <Text style={styles.gradientButtonText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title="Bubble Updated!"
        subtitle="Your changes have been saved successfully"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  form: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: 40,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.charcoal,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    fontSize: Typography.sizes.base,
    backgroundColor: Colors.neutral.cloudGrey,
    color: Colors.neutral.charcoal,
  },
  textArea: {
    minHeight: 100,
  },
  categoryDisplay: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.background.surface,
  },
  categoryDisplayText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
  },
  privacyOptions: {
    gap: Spacing.sm,
    marginTop: Spacing.xxs,
  },
  saveButton: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.neutral.charcoal,
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
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
  ruleContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  ruleText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
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
  ruleDragHandle: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
  },
  ruleModalInput: {
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
    backgroundColor: Colors.background.primary,
    minHeight: 48,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
  modalSecondaryText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.secondary,
  },
  gradientButton: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.background.primary,
    letterSpacing: Typography.letterSpacing.tight,
  },
});
