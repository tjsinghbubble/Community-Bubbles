import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import apiService from '../../services/api.service';
import { Colors, Spacing, Typography, CardShadow } from '../../styles/theme';
import ScreenHeader from '../../components/ScreenHeader';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'ManageRules'>;
};

type RuleItem = {
  id: number;
  ruleId: number;
  name: string;
  description: string;
  position: number;
};

type CategoryItem = {
  id: number;
  name: string;
  displayName: string;
  parentId: number | null;
};

export default function ManageRulesScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<'app' | 'category'>('app');
  const [appRules, setAppRules] = useState<RuleItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryRules, setCategoryRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');

  useEffect(() => {
    fetchAppRules();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchCategoryRules(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  const fetchAppRules = async () => {
    try {
      setLoading(true);
      const rules = await apiService.getAppRules();
      setAppRules((rules || []).map((r: any) => {
        const rName = r.rule?.name || r.name || '';
        const rDesc = r.rule?.description || r.description || '';
        const rText = r.rule?.text || r.text || '';
        if (rName) return { id: r.id, ruleId: r.ruleId, name: rName, description: rDesc, position: r.position };
        const dotIdx = rText.indexOf('. ');
        if (dotIdx > 0) return { id: r.id, ruleId: r.ruleId, name: rText.substring(0, dotIdx), description: rText.substring(dotIdx + 2), position: r.position };
        return { id: r.id, ruleId: r.ruleId, name: rText, description: '', position: r.position };
      }));
    } catch (e) {
      console.error('Failed to fetch app rules:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await apiService.getCategoriesFlat();
      setCategories((data || []).filter((c: any) => c.parentId !== null));
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  const fetchCategoryRules = async (categoryId: number) => {
    try {
      const rules = await apiService.getCategoryRules(categoryId);
      setCategoryRules((rules || []).map((r: any) => {
        const rName = r.rule?.name || r.name || '';
        const rDesc = r.rule?.description || r.description || '';
        const rText = r.rule?.text || r.text || '';
        if (rName) return { id: r.id, ruleId: r.ruleId, name: rName, description: rDesc, position: r.position };
        const dotIdx = rText.indexOf('. ');
        if (dotIdx > 0) return { id: r.id, ruleId: r.ruleId, name: rText.substring(0, dotIdx), description: rText.substring(dotIdx + 2), position: r.position };
        return { id: r.id, ruleId: r.ruleId, name: rText, description: '', position: r.position };
      }));
    } catch (e) {
      console.error('Failed to fetch category rules:', e);
      setCategoryRules([]);
    }
  };

  const handleAddRule = async () => {
    const trimmedName = ruleName.trim();
    if (!trimmedName) return;
    const trimmedDesc = ruleDescription.trim();

    try {
      if (activeTab === 'app') {
        await apiService.addAppRule(trimmedName, trimmedDesc, appRules.length + 1);
        await fetchAppRules();
      } else if (selectedCategoryId) {
        await apiService.addCategoryRule(selectedCategoryId, trimmedName, trimmedDesc, categoryRules.length + 1);
        await fetchCategoryRules(selectedCategoryId);
      }
      setRuleName('');
      setRuleDescription('');
      setShowAddModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add rule');
    }
  };

  const handleEditRule = async () => {
    if (!editingRule) return;
    const trimmedName = ruleName.trim();
    if (!trimmedName) return;
    const trimmedDesc = ruleDescription.trim();

    try {
      if (activeTab === 'app') {
        await apiService.updateAppRule(editingRule.ruleId, trimmedName, trimmedDesc);
        await fetchAppRules();
      } else if (selectedCategoryId) {
        await apiService.updateCategoryRule(selectedCategoryId, editingRule.ruleId, trimmedName, trimmedDesc);
        await fetchCategoryRules(selectedCategoryId);
      }
      setRuleName('');
      setRuleDescription('');
      setEditingRule(null);
      setShowEditModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update rule');
    }
  };

  const handleDeleteRule = (rule: RuleItem) => {
    Alert.alert('Delete Rule', 'Are you sure you want to delete this rule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (activeTab === 'app') {
              await apiService.deleteAppRule(rule.ruleId);
              await fetchAppRules();
            } else if (selectedCategoryId) {
              await apiService.deleteCategoryRule(selectedCategoryId, rule.ruleId);
              await fetchCategoryRules(selectedCategoryId);
            }
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete rule');
          }
        },
      },
    ]);
  };

  const handleMoveUp = async (index: number, rules: RuleItem[], isApp: boolean) => {
    if (index <= 0) return;
    const reordered = [...rules];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    const ruleIds = reordered.map(r => r.ruleId);
    try {
      if (isApp) {
        await apiService.reorderAppRules(ruleIds);
        await fetchAppRules();
      } else if (selectedCategoryId) {
        await apiService.reorderCategoryRules(selectedCategoryId, ruleIds);
        await fetchCategoryRules(selectedCategoryId);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reorder');
    }
  };

  const handleMoveDown = async (index: number, rules: RuleItem[], isApp: boolean) => {
    if (index >= rules.length - 1) return;
    const reordered = [...rules];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    const ruleIds = reordered.map(r => r.ruleId);
    try {
      if (isApp) {
        await apiService.reorderAppRules(ruleIds);
        await fetchAppRules();
      } else if (selectedCategoryId) {
        await apiService.reorderCategoryRules(selectedCategoryId, ruleIds);
        await fetchCategoryRules(selectedCategoryId);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reorder');
    }
  };

  const currentRules = activeTab === 'app' ? appRules : categoryRules;

  const renderRule = ({ item, index }: { item: RuleItem; index: number }) => (
    <View style={styles.ruleCard} data-testid={`rule-card-${item.ruleId}`}>
      <View style={styles.ruleContent}>
        <Text style={styles.rulePosition}>{index + 1}.</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.ruleText}>{item.name}</Text>
          {item.description ? <Text style={styles.ruleDescriptionText}>{item.description}</Text> : null}
        </View>
      </View>
      <View style={styles.ruleActions}>
        <TouchableOpacity
          style={[styles.actionButton, index === 0 && styles.actionDisabled]}
          onPress={() => handleMoveUp(index, currentRules, activeTab === 'app')}
          disabled={index === 0}
          data-testid={`button-move-up-${item.ruleId}`}
        >
          <Ionicons name="arrow-up" size={16} color={index === 0 ? Colors.text.tertiary : Colors.brand.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, index === currentRules.length - 1 && styles.actionDisabled]}
          onPress={() => handleMoveDown(index, currentRules, activeTab === 'app')}
          disabled={index === currentRules.length - 1}
          data-testid={`button-move-down-${item.ruleId}`}
        >
          <Ionicons name="arrow-down" size={16} color={index === currentRules.length - 1 ? Colors.text.tertiary : Colors.brand.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setEditingRule(item);
            setRuleName(item.name);
            setRuleDescription(item.description);
            setShowEditModal(true);
          }}
          data-testid={`button-edit-${item.ruleId}`}
        >
          <Ionicons name="pencil" size={16} color={Colors.brand.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteRule(item)}
          data-testid={`button-delete-${item.ruleId}`}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Manage Rules" onBack={() => navigation.goBack()} />

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'app' && styles.tabActive]}
          onPress={() => setActiveTab('app')}
          data-testid="tab-app-rules"
        >
          <Text style={[styles.tabText, activeTab === 'app' && styles.tabTextActive]}>App Rules</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'category' && styles.tabActive]}
          onPress={() => setActiveTab('category')}
          data-testid="tab-category-rules"
        >
          <Text style={[styles.tabText, activeTab === 'category' && styles.tabTextActive]}>Category Rules</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'category' && (
        <View style={styles.categoryPicker}>
          <Text style={styles.pickerLabel}>Select Category:</Text>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryChip, selectedCategoryId === item.id && styles.categoryChipActive]}
                onPress={() => setSelectedCategoryId(item.id)}
                data-testid={`chip-category-${item.id}`}
              >
                <Text style={[styles.categoryChipText, selectedCategoryId === item.id && styles.categoryChipTextActive]}>
                  {item.displayName || item.name}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoryList}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={currentRules}
          keyExtractor={(item) => String(item.ruleId)}
          renderItem={renderRule}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {activeTab === 'category' && !selectedCategoryId
                  ? 'Select a category to manage its rules'
                  : 'No rules yet. Tap + to add one.'}
              </Text>
            </View>
          }
        />
      )}

      {(activeTab === 'app' || (activeTab === 'category' && selectedCategoryId)) && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setRuleName('');
            setRuleDescription('');
            setShowAddModal(true);
          }}
          data-testid="button-add-rule"
        >
          <Ionicons name="add" size={28} color={Colors.background.primary} />
        </TouchableOpacity>
      )}

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Rule</Text>
            <TextInput
              style={styles.modalInput}
              value={ruleName}
              onChangeText={setRuleName}
              placeholder="Rule name..."
              placeholderTextColor={Colors.neutral.coolMist}
              data-testid="input-rule-name"
            />
            <TextInput
              style={[styles.modalInput, { minHeight: 80 }]}
              value={ruleDescription}
              onChangeText={setRuleDescription}
              placeholder="Description (optional)..."
              placeholderTextColor={Colors.neutral.coolMist}
              multiline
              data-testid="input-rule-description"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAddModal(false)} data-testid="button-cancel-add">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, !ruleName.trim() && { opacity: 0.5 }]} onPress={handleAddRule} disabled={!ruleName.trim()} data-testid="button-save-rule">
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Rule</Text>
            <TextInput
              style={styles.modalInput}
              value={ruleName}
              onChangeText={setRuleName}
              placeholder="Rule name..."
              placeholderTextColor={Colors.neutral.coolMist}
              data-testid="input-edit-rule-name"
            />
            <TextInput
              style={[styles.modalInput, { minHeight: 80 }]}
              value={ruleDescription}
              onChangeText={setRuleDescription}
              placeholder="Description (optional)..."
              placeholderTextColor={Colors.neutral.coolMist}
              multiline
              data-testid="input-edit-rule-description"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditModal(false)} data-testid="button-cancel-edit">
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, !ruleName.trim() && { opacity: 0.5 }]} onPress={handleEditRule} disabled={!ruleName.trim()} data-testid="button-update-rule">
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.background.secondary,
  },
  tabActive: {
    backgroundColor: Colors.brand.primary,
  },
  tabText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  tabTextActive: {
    color: Colors.background.primary,
  },
  categoryPicker: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  pickerLabel: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  categoryList: {
    paddingBottom: Spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    backgroundColor: Colors.background.secondary,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
  },
  categoryChipActive: {
    backgroundColor: Colors.brand.primary,
    borderColor: Colors.brand.primary,
  },
  categoryChipText: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.charcoal,
  },
  categoryChipTextActive: {
    color: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  ruleCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
    ...CardShadow,
  },
  ruleContent: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  rulePosition: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold as any,
    color: Colors.brand.primary,
    marginRight: Spacing.sm,
    minWidth: 20,
  },
  ruleText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.md,
  },
  ruleDescriptionText: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.sm,
    marginTop: 2,
  },
  ruleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  emptyContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  modalCancel: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.background.secondary,
  },
  modalCancelText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
  },
  modalSave: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.brand.primary,
  },
  modalSaveText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.background.primary,
  },
});
