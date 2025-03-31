// PreviewModal.tsx
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface PreviewModalProps {
  visible: boolean;
  form: {
    image: string;
    pname: string;
    aname: string;
    img_alt: string;
    img_title: string;
    pdesc: string;
  };
  selectedCategory: string;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  visible,
  form,
  selectedCategory,
  onClose,
}) => {
  const windowHeight = Dimensions.get("window").height;
  const [contentHeight, setContentHeight] = useState<number>(0);

  // Force re-render when modal becomes visible to ensure proper layout
  useEffect(() => {
    if (visible) {
      setContentHeight(0); // Reset to trigger layout
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { maxHeight: windowHeight * 0.85 }]}
            >
              {/* Header with title */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderText}>Preview</Text>
                <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Scrollable content area */}
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                  styles.scrollContent,
                  contentHeight < windowHeight * 0.7 ? { flexGrow: 1 } : {},
                ]}
                scrollEnabled={true}
                showsVerticalScrollIndicator={true}
                onContentSizeChange={(width, height) =>
                  setContentHeight(height)
                }
              >
                <Text style={styles.previewTitle}>{form.pname}</Text>
                {form.image ? (
                  <Image
                    source={{ uri: form.image }}
                    style={styles.previewImage}
                    resizeMode="cover"
                    accessibilityLabel={form.img_alt || "Preview image"}
                  />
                ) : null}

                <Text style={styles.previewSubtitle}>
                  By {form.aname} | Category: {selectedCategory}
                </Text>
                <Text style={styles.previewText}>{form.pdesc}</Text>

                {/* Add extra spacing at bottom to ensure scrollability */}
                <View style={{ height: 40 }} />
              </ScrollView>

              {/* Footer with close button */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>Close Preview</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    position: "relative",
  },
  modalHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeIcon: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  closeIconText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  scrollView: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: 20,
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  previewSubtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 15,
  },
  previewText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
  },
  buttonContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  closeButton: {
    backgroundColor: "#1a8e2d",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default PreviewModal;
