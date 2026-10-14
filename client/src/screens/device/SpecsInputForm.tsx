import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

export type Specification = {
  id: number;
  name: string;
  value: string;
};

type SpecsInputFormProps = {
  onChange: (specifications: Specification[]) => void;
  validateSignal: number;
  onValidityChange: (isValid: boolean) => void;
};

export function SpecsInputForm({ onChange, validateSignal, onValidityChange }: SpecsInputFormProps) {
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [nextId, setNextId] = useState(1);
  const [touched, setTouched] = useState<number[]>([]);

  useEffect(() => {
    if (validateSignal === 0) return;
    setTouched(specifications.map((item) => item.id));
    onValidityChange(specifications.every((item) => item.name.trim() && item.value.trim()));
  }, [validateSignal]);

  const updateSpecifications = (next: Specification[]) => {
    setSpecifications(next);
    onChange(next);
    onValidityChange(next.every((item) => item.name.trim() && item.value.trim()));
  };

  const addSpecification = () => {
    updateSpecifications([...specifications, { id: nextId, name: '', value: '' }]);
    setNextId((id) => id + 1);
  };

  const strings = STRINGS.POST_DEVICE.SPECS_FORM;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{strings.TITLE}</Text>
      <Text style={styles.description}>{strings.DESC}</Text>
      {specifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={22} color={colors.light.primary} />
          <Text style={styles.emptyTitle}>{strings.EMPTY_TITLE}</Text>
          <Text style={styles.emptyText}>{strings.EMPTY_DESC}</Text>
        </View>
      ) : specifications.map((item) => {
        const invalid = touched.includes(item.id) && (!item.name.trim() || !item.value.trim());
        const update = (field: 'name' | 'value', value: string) => {
          updateSpecifications(specifications.map((spec) => spec.id === item.id ? { ...spec, [field]: value } : spec));
        };
        const markTouched = () => setTouched((current) => current.includes(item.id) ? current : [...current, item.id]);
        return (
          <View key={item.id} style={styles.specCard}>
            <View style={styles.specHeader}>
              <Text style={styles.specNumber}>{strings.SPEC_NUMBER_PREFIX}{item.id}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={strings.DELETE_ACCESSIBILITY}
                onPress={() => {
                  updateSpecifications(specifications.filter((spec) => spec.id !== item.id));
                  setTouched(touched.filter((id) => id !== item.id));
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputColumn}>
                <Text style={styles.fieldLabel}>{strings.LABEL_SPEC}</Text>
                <TextInput
                  value={item.name}
                  onChangeText={(value) => update('name', value)}
                  onBlur={markTouched}
                  placeholder={strings.PLACEHOLDER_SPEC}
                  placeholderTextColor={colors.light.textSecondary}
                  style={[styles.input, invalid && styles.inputError]}
                />
              </View>
              <View style={styles.inputColumn}>
                <Text style={styles.fieldLabel}>{strings.LABEL_VALUE}</Text>
                <TextInput
                  value={item.value}
                  onChangeText={(value) => update('value', value)}
                  onBlur={markTouched}
                  placeholder={strings.PLACEHOLDER_VALUE}
                  placeholderTextColor={colors.light.textSecondary}
                  style={[styles.input, invalid && styles.inputError]}
                />
              </View>
            </View>
            {invalid ? <Text style={styles.errorText}>{strings.ERR_ENTER_BOTH}</Text> : null}
          </View>
        );
      })}
      <TouchableOpacity style={styles.addButton} onPress={addSpecification} activeOpacity={0.8}>
        <Ionicons name="add" size={18} color={colors.light.primary} />
        <Text style={styles.addButtonText}>{strings.BTN_ADD}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.light.card },
  title: { color: colors.light.textPrimary, fontSize: 18, fontWeight: '800' },
  description: { color: colors.light.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 14 },
  specCard: { backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.borderDefault, borderRadius: 12, padding: 12, marginBottom: 10 },
  specHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  specNumber: { color: colors.light.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputColumn: { flex: 1 },
  fieldLabel: { color: colors.light.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { height: 44, backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.borderDefault, borderRadius: 10, paddingHorizontal: 11, color: colors.light.textPrimary, fontSize: 13 },
  inputError: { borderColor: colors.light.danger },
  errorText: { color: colors.light.danger, fontSize: 11, marginTop: 8 },
  addButton: { height: 45, borderRadius: 12, backgroundColor: colors.light.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 2 },
  addButtonText: { color: colors.light.primary, fontSize: 13, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.light.borderDefault, borderRadius: 12, marginBottom: 12 },
  emptyTitle: { color: colors.light.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyText: { color: colors.light.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
});
