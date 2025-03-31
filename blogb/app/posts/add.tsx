import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as Notifications from "expo-notifications";
import PreviewModal from "./PreviewModal";

const { width } = Dimensions.get("window");

interface FormDataType {
  image: string;
  pname: string;
  aname: string;
  img_alt: string;
  img_title: string;
  pdesc: string;
}

const AddBlogPostScreen: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const router = useRouter();
  const [form, setForm] = useState<FormDataType>({
    image: "",
    pname: "",
    aname: "",
    img_alt: "",
    img_title: "",
    pdesc: "",
  });

  // State for categories coming from the server.
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showCategoryDropdown, setShowCategoryDropdown] =
    useState<boolean>(false);
  const [showPostOptions, setShowPostOptions] = useState<boolean>(false);
  const [isDatePickerVisible, setDatePickerVisibility] =
    useState<boolean>(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());

  // State for "Create New Category" modal.
  const [showCreateCategoryModal, setShowCreateCategoryModal] =
    useState<boolean>(false);
  const [newCategory, setNewCategory] = useState<string>("");

  // New state for preview modal.
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Fetch categories from the server when the component mounts.
  useEffect(() => {
    fetchCategories();
  }, []);

  // Register for notifications on mount.
  useEffect(() => {
    registerForPushNotifications();
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }, []);

  // Fetch categories from the API.
  const fetchCategories = async () => {
    try {
      const response = await fetch("http://172.20.10.4:5000/api/categories");
      const data = await response.json();
      // Assuming each category object has a 'name' property.
      const catNames = data.map(
        (cat: { id: number; name: string }) => cat.name
      );
      // Add the "Create New" option at the end.
      setCategories([...catNames, " + Create New"]);
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Optional fallback if API fails.
      setCategories([
        "Technology",
        "Politics",
        "Finance",
        "Travel",
        "Science",
        "Create New",
      ]);
    }
  };

  async function registerForPushNotifications() {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert("Failed to get push token for push notifications!");
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log(token);
  }

  // Image picker function.
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== "granted") {
      Alert.alert("Permission to access the media library is required!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled) {
      const selectedImageUri = result.assets[0].uri;
      console.log("Selected image URI:", selectedImageUri);
      setImage(selectedImageUri);
      setForm({ ...form, image: selectedImageUri });
    }
  };

  // Function to submit the post using FormData.
  const submitPost = async (
    scheduledTime: Date | null = null
  ): Promise<void> => {
    const postType = scheduledTime ? "schedule" : "now";
    const data = new FormData();

    // Append file if image exists.
    if (image) {
      // On Android, convert the file URI to a blob.
      if (Platform.OS === "android") {
        try {
          const response = await fetch(image);
          const blob = await response.blob();
          data.append("file", blob, "upload.jpg");
        } catch (error) {
          console.error("Error converting image to blob:", error);
        }
      } else {
        // On iOS, you can append the file object directly.
        data.append("file", {
          uri: image,
          name: "upload.jpg",
          type: "image/jpeg",
        } as any);
      }
    }

    // Append other fields.
    data.append("pname", form.pname);
    data.append("aname", form.aname);
    data.append("img_alt", form.img_alt);
    data.append("img_title", form.img_title);
    data.append("pdesc", form.pdesc);
    data.append("cname", selectedCategory);
    data.append("stime", scheduledTime ? scheduledTime.toISOString() : "");
    data.append("postType", postType);

    try {
      const response = await fetch("http://172.20.10.4:5000/api/add-post", {
        method: "POST",
        // Do not set Content-Type manually when using FormData.
        body: data,
      });
      const result = await response.json();
      if (response.ok) {
        console.log("Post stored successfully:", result);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Post Submitted!",
            body: "Your post has been submitted successfully.",
          },
          trigger: null,
        });
        router.back();
      } else {
        console.error("Error storing post:", result.error);
      }
    } catch (error) {
      console.error("Error submitting post:", error);
    }
  };

  // Preview action: Instead of navigating, show the preview modal.
  const handlePreview = () => {
    setShowPreviewModal(true);
  };

  // Handler for saving a new category via the API.
  const handleSaveCategory = async () => {
    if (newCategory.trim().length > 0) {
      try {
        const response = await fetch(
          "http://172.20.10.4:5000/api/add-category",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newCategory.trim() }),
          }
        );
        const result = await response.json();
        if (response.ok) {
          await fetchCategories(); // Refresh categories from the server.
          setSelectedCategory(newCategory.trim());
          setNewCategory("");
          setShowCreateCategoryModal(false);
        } else {
          console.error("Error adding category:", result.error);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#1a8e2d", "#146922"]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={28} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Post</Text>
          </View>
        </LinearGradient>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 5 : 5}
      >
        {/* Scrollable Form */}
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Upload */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.imageUploadButton}
              onPress={pickImage}
            >
              <Ionicons name="image" size={24} color="#1a8e2d" />
              <Text style={styles.imageUploadText}>Upload Image</Text>
            </TouchableOpacity>
            {image && <Image source={{ uri: image }} style={styles.image} />}
          </View>

          {/* Image Alt Attribute */}
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Image Alt Attribute"
              placeholderTextColor="#999"
              value={form.img_alt}
              onChangeText={(text) => setForm({ ...form, img_alt: text })}
            />
          </View>

          {/* Image Title Attribute */}
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Image Title Attribute"
              placeholderTextColor="#999"
              value={form.img_title}
              onChangeText={(text) => setForm({ ...form, img_title: text })}
            />
          </View>

          {/* Post Name */}
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Post Name"
              placeholderTextColor="#999"
              value={form.pname}
              onChangeText={(text) => setForm({ ...form, pname: text })}
            />
          </View>

          {/* Author */}
          <View style={styles.section}>
            <TextInput
              style={styles.input}
              placeholder="Author"
              placeholderTextColor="#999"
              value={form.aname}
              onChangeText={(text) => setForm({ ...form, aname: text })}
            />
          </View>

          {/* Blog Editor */}
          <View style={styles.section}>
            <TextInput
              style={styles.editor}
              placeholder="Write your post here..."
              placeholderTextColor="#999"
              value={form.pdesc}
              onChangeText={(text) => setForm({ ...form, pdesc: text })}
              multiline
            />
          </View>

          {/* Category Dropdown */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <Text style={styles.dropdownButtonText}>
                {selectedCategory || "Select Category"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#333" />
            </TouchableOpacity>
            {showCategoryDropdown && (
              <View style={styles.dropdownOptions}>
                {categories.map((cat, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dropdownOption}
                    onPress={() => {
                      if (cat.includes("Create New")) {
                        setShowCreateCategoryModal(true);
                        setShowCategoryDropdown(false);
                      } else {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer with "Preview" and "Post" Buttons */}
      <View style={styles.footer}>
        <View style={styles.footerButtonsContainer}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreview}
          >
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postButton}
            onPress={() => setShowPostOptions(true)}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreviewModal}
        form={form}
        selectedCategory={selectedCategory}
        onClose={() => setShowPreviewModal(false)}
      />

      {/* Modal for Post Options */}
      <Modal
        visible={showPostOptions}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPostOptions(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPostOptions(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Posting Option</Text>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setShowPostOptions(false);
                    submitPost();
                  }}
                >
                  <Text style={styles.optionText}>Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setShowPostOptions(false);
                    setDatePickerVisibility(true);
                  }}
                >
                  <Text style={styles.optionText}>Schedule Later</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal for "Create New Category" */}
      <Modal
        visible={showCreateCategoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateCategoryModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowCreateCategoryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Create New Category</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter category name"
                  placeholderTextColor="#999"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-around",
                    marginTop: 20,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowCreateCategoryModal(false)}
                  >
                    <Text style={styles.optionText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveCategory}>
                    <Text style={styles.optionText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Date/Time Picker Modal for "Schedule Later" */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={(date) => {
          setDatePickerVisibility(false);
          setScheduledDate(date);
          submitPost(date);
        }}
        onCancel={() => setDatePickerVisibility(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  headerContainer: { height: 120, width: "100%" },
  headerGradient: { flex: 1, justifyContent: "flex-end", paddingBottom: 10 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,

    justifyContent: "center",
    alignItems: "center",

    elevation: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    marginLeft: 15,
  },
  formContainer: { flex: 1 },
  formContentContainer: { padding: 20 },
  section: { marginBottom: 25 },
  input: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: "#333",
  },
  editor: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: "#333",
    height: 200,
    textAlignVertical: "top",
  },
  imageUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "white",
    borderRadius: 16,
  },
  imageUploadText: { marginLeft: 10, fontSize: 16, color: "#333" },
  image: { width: 200, height: 200, marginTop: 10, borderRadius: 8 },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 16,
  },
  dropdownButtonText: { fontSize: 16, color: "#333" },
  dropdownOptions: { backgroundColor: "white" },
  dropdownOption: { padding: 15 },
  dropdownOptionText: { fontSize: 16, color: "#333" },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  footerButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewButton: {
    flex: 1,
    marginRight: 10,
    backgroundColor: "#f0f0f0",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  previewButtonText: { fontSize: 16, color: "#333", fontWeight: "700" },
  postButton: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: "#1a8e2d",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  postButtonText: { fontSize: 16, color: "white", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "40%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  optionItem: { paddingVertical: 15 },
  optionText: { fontSize: 18, color: "#333", textAlign: "center" },
  footerText: { flexDirection: "row", marginTop: 20 },
  footerLabel: { fontSize: 14, color: "#333" },
  footerLink: {
    fontSize: 14,
    color: "#1a8e2d",
    textDecorationLine: "underline",
  },
});

export default AddBlogPostScreen;
