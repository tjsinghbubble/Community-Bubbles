import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';

type LocationData = {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: LocationData) => void;
  apiKey: string;
};

export default function LocationPickerModal({ visible, onClose, onSelect, apiKey }: Props) {
  const ref = useRef<any>(null);

  const handleSelect = (data: any, details: any) => {
    const location: LocationData = {
      name: data.structured_formatting?.main_text || data.description,
      address: details?.formatted_address || data.description,
      latitude: details?.geometry?.location?.lat,
      longitude: details?.geometry?.location?.lng,
      placeId: data.place_id,
    };
    onSelect(location);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search Location</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.searchContainer}>
          <GooglePlacesAutocomplete
            ref={ref}
            placeholder="Search for a place..."
            fetchDetails={true}
            onPress={handleSelect}
            query={{
              key: apiKey,
              language: 'en',
            }}
            styles={{
              container: {
                flex: 0,
              },
              textInputContainer: {
                backgroundColor: '#f5f5f5',
                borderRadius: 12,
                paddingHorizontal: 12,
              },
              textInput: {
                height: 48,
                color: '#333',
                fontSize: 16,
                backgroundColor: 'transparent',
              },
              listView: {
                backgroundColor: '#fff',
                marginTop: 8,
                borderRadius: 12,
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              },
              row: {
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#f0f0f0',
              },
              description: {
                fontSize: 15,
                color: '#333',
              },
              poweredContainer: {
                display: 'none',
              },
              powered: {
                display: 'none',
              },
            }}
            textInputProps={{
              placeholderTextColor: '#999',
              autoFocus: true,
            }}
            enablePoweredByContainer={false}
            debounce={300}
            minLength={2}
            nearbyPlacesAPI="GooglePlacesSearch"
            renderLeftButton={() => (
              <View style={styles.searchIcon}>
                <Ionicons name="search" size={20} color="#999" />
              </View>
            )}
            renderRow={(data) => (
              <View style={styles.rowContent}>
                <Ionicons name="location" size={20} color="hsl(210, 95%, 55%)" />
                <View style={styles.rowText}>
                  <Text style={styles.mainText} numberOfLines={1}>
                    {data.structured_formatting?.main_text || data.description}
                  </Text>
                  {data.structured_formatting?.secondary_text && (
                    <Text style={styles.secondaryText} numberOfLines={1}>
                      {data.structured_formatting.secondary_text}
                    </Text>
                  )}
                </View>
              </View>
            )}
          />
        </View>

        <View style={styles.tipContainer}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.tipText}>
            Search for venues, addresses, or landmarks
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 1,
  },
  searchIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  mainText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  secondaryText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
});
