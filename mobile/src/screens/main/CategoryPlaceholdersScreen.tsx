import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { useAuth } from '../../context/AuthContext';
import { Colors, Spacing, Typography, CardShadow, Radius } from '../../styles/theme';
import { NavHeader } from '../../components/ScreenHeader';
import { API_URL } from '../../config/api';

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'CategoryPlaceholders'>;
};

type CategoryItem = {
  id: number;
  name: string;
  displayName: string | null;
  parentId: number | null;
  displayOrder: number;
};

type CategoryGroup = {
  id: number;
  displayName: string | null;
  header: string | null;
  children: CategoryItem[];
};

type PlaceholderRow = {
  id: number;
  categoryId: number;
  fieldType: string;
  value: string;
  displayOrder: number;
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Bubble Name',
  tagline: 'Tagline',
  description: 'Description',
};

const FIELD_ORDER = ['name', 'tagline', 'description'];

export default function CategoryPlaceholdersScreen({ navigation }: Props) {
  const { token } = useAuth();

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [allPlaceholders, setAllPlaceholders] = useState<PlaceholderRow[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<PlaceholderRow | null>(null);
  const [modalFieldType, setModalFieldType] = useState('name');
  const [modalValue, setModalValue] = useState('');
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetchCategories();
    fetchAllPlaceholders();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categories`, { headers });
      if (res.ok) {
        const data: (CategoryGroup & { children: CategoryItem[] })[] = await res.json();
        setCategoryGroups(data.filter(g => g.children && g.children.length > 0));
      }
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchAllPlaceholders = async () => {
    setLoadingPlaceholders(true);
    try {
      const res = await fetch(`${API_URL}/api/category-placeholders`, { headers });
      if (res.ok) {
        const data: PlaceholderRow[] = await res.json();
        setAllPlaceholders(data);
      }
    } catch (e) {
      console.error('Failed to fetch placeholders:', e);
    } finally {
      setLoadingPlaceholders(false);
    }
  };

  const categoryPlaceholders = selectedCategory
    ? allPlaceholders.filter(p => p.categoryId === selectedCategory.id)
    : [];

  const grouped: Record<string, PlaceholderRow[]> = {};
  for (const ft of FIELD_ORDER) {
    grouped[ft] = categoryPlaceholders.filter(p => p.fieldType === ft)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const openAdd = (fieldType: string) => {
    setEditingRow(null);
    setModalFieldType(fieldType);
    setModalValue('');
    setShowModal(true);
  };

  const openEdit = (row: PlaceholderRow) => {
    setEditingRow(row);
    setModalFieldType(row.fieldType);
    setModalValue(row.value);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!modalValue.trim() || !selectedCategory) return;
    setSaving(true);
    try {
      if (editingRow) {
        const res = await fetch(`${API_URL}/api/category-placeholders/${editingRow.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ value: modalValue.trim() }),
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated: PlaceholderRow = await res.json();
        setAllPlaceholders(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const res = await fetch(`${API_URL}/api/categories/${selectedCategory.id}/placeholders`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ fieldType: modalFieldType, value: modalValue.trim() }),
        });
        if (!res.ok) throw new Error('Failed to create');
        const created: PlaceholderRow = await res.json();
        setAllPlaceholders(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (row: PlaceholderRow) => {
    Alert.alert(
      'Delete Placeholder',
      `Delete "${row.value}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/category-placeholders/${row.id}`, {
                method: 'DELETE',
                headers,
              });
              if (!res.ok) throw new Error('Failed to delete');
              setAllPlaceholders(prev => prev.filter(p => p.id !== row.id));
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Something went wrong');
            }
          },
        },
      ]
    );
  };

  const renderFieldGroup = (fieldType: string) => {
    const items = grouped[fieldType] || [];
    return (
      <View key={fieldType} style={styles.fieldGroup}>
        <View style={styles.fieldGroupHeader}>
          <Text style={styles.fieldGroupLabel}>{FIELD_LABELS[fieldType]}</Text>
          <TouchableOpacity onPress={() => openAdd(fieldType)} style={styles.addBtn}>
            <Ionicons name="add" size={18} color={Colors.brand.bubbleBlue} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {items.length === 0 ? (
          <Text style={styles.emptyField}>No placeholders yet</Text>
        ) : (
          items.map(row => (
            <View key={row.id} style={styles.placeholderRow}>
              <Text style={styles.placeholderValue} numberOfLines={2}>{row.value}</Text>
              <View style={styles.rowActions}>
                <TouchableOpacity onPress={() => openEdit(row)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={Colors.neutral.charcoal} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(row)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <NavHeader title="Category Placeholders" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <TouchableOpacity
          style={styles.categorySelector}
          onPress={() => setShowCategoryPicker(true)}
          activeOpacity={0.8}
        >
          <Text style={selectedCategory ? styles.categorySelectorText : styles.categorySelectorPlaceholder}>
            {selectedCategory ? (selectedCategory.displayName || selectedCategory.name) : 'Select a subcategory...'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.neutral.charcoal} />
        </TouchableOpacity>

        {!selectedCategory ? (
          <Text style={styles.hint}>Select a subcategory above to manage its placeholder suggestions.</Text>
        ) : loadingPlaceholders ? (
          <ActivityIndicator color={Colors.brand.bubbleBlue} style={{ marginTop: 32 }} />
        ) : (
          <View style={styles.placeholderContent}>
            {FIELD_ORDER.map(ft => renderFieldGroup(ft))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Subcategory</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={22} color={Colors.brand.midnight} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {loadingCategories ? (
                <ActivityIndicator color={Colors.brand.bubbleBlue} style={{ margin: 24 }} />
              ) : (
                categoryGroups.map(group => (
                  <View key={group.id}>
                    <Text style={styles.pickerGroupLabel}>{group.header || group.displayName}</Text>
                    {group.children.map(child => (
                      <TouchableOpacity
                        key={child.id}
                        style={[
                          styles.pickerItem,
                          selectedCategory?.id === child.id && styles.pickerItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedCategory(child);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          selectedCategory?.id === child.id && styles.pickerItemTextSelected,
                        ]}>
                          {child.displayName || child.name}
                        </Text>
                        {selectedCategory?.id === child.id && (
                          <Ionicons name="checkmark" size={18} color={Colors.brand.bubbleBlue} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              {editingRow ? 'Edit Placeholder' : `Add ${FIELD_LABELS[modalFieldType]}`}
            </Text>
            <Text style={styles.modalSubtitle}>{FIELD_LABELS[modalFieldType]}</Text>
            <TextInput
              style={[styles.modalInput, modalFieldType === 'description' && { height: 80 }]}
              value={modalValue}
              onChangeText={setModalValue}
              placeholder={`Enter placeholder text...`}
              placeholderTextColor={Colors.text.tertiary}
              multiline={modalFieldType === 'description'}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, (!modalValue.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!modalValue.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    ...CardShadow,
  },
  categorySelectorText: {
    fontSize: 15,
    fontWeight: Typography.weights.medium as any,
    color: Colors.brand.midnight,
  },
  categorySelectorPlaceholder: {
    fontSize: 15,
    fontWeight: Typography.weights.regular as any,
    color: Colors.text.tertiary,
  },
  hint: {
    fontSize: 14,
    fontWeight: Typography.weights.regular as any,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
  },
  placeholderContent: {
    gap: Spacing.md,
  },
  fieldGroup: {
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...CardShadow,
  },
  fieldGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  fieldGroupLabel: {
    fontSize: 13,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: Typography.weights.medium as any,
    color: Colors.brand.bubbleBlue,
  },
  emptyField: {
    fontSize: 13,
    fontWeight: Typography.weights.regular as any,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
    paddingVertical: Spacing.xs,
  },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: Spacing.sm,
  },
  placeholderValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: Typography.weights.regular as any,
    color: Colors.brand.midnight,
    lineHeight: 20,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.midnight,
  },
  pickerScroll: {
    padding: Spacing.md,
  },
  pickerGroupLabel: {
    fontSize: 11,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.neutral.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: 2,
  },
  pickerItemSelected: {
    backgroundColor: `${Colors.brand.bubbleBlue}15`,
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: Typography.weights.regular as any,
    color: Colors.brand.midnight,
  },
  pickerItemTextSelected: {
    fontWeight: Typography.weights.medium as any,
    color: Colors.brand.bubbleBlue,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.midnight,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: Typography.weights.regular as any,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: Typography.weights.regular as any,
    color: Colors.brand.midnight,
    backgroundColor: '#FAFAFA',
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: Typography.weights.medium as any,
    color: Colors.neutral.charcoal,
  },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.brand.bubbleBlue,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: Typography.weights.semiBold as any,
    color: '#fff',
  },
});
