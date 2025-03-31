import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import PreviewModal from "../posts/PreviewModal";
import config from "@/config";
const { width } = Dimensions.get("window");

// Instead of dummy categories, we will fetch real categories.
const BASE_URL = config.apiUrl;

// Helper: decode and normalize a parameter to a string.
const getParamAsString = (param: string | string[] | undefined): string =>
  param ? decodeURIComponent(typeof param === "string" ? param : param[0]) : "";

// Helper: Construct a full URL for the image.
const getFullImageUrl = (
  imagePath: string | null | undefined
): string | null => {
  if (!imagePath || imagePath.trim() === "") {
    console.log("No image path provided");
    return null;
  }
  if (imagePath.startsWith("http") || imagePath.startsWith("file://")) {
    return imagePath;
  }
  let processedPath = imagePath;
  if (!processedPath.startsWith("/")) {
    processedPath = "/" + processedPath;
    console.log("Added leading slash:", processedPath);
  }
  const fullUrl = `${BASE_URL}${processedPath}`;
  console.log("Constructed full URL:", fullUrl);
  return fullUrl;
};

export default function EditBlogPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Normalize incoming parameters.
  const normalizedParams = {
    id: getParamAsString(params.id),
    image: getParamAsString(params.image),
    pname: getParamAsString(params.pname),
    aname: getParamAsString(params.aname),
    img_alt: getParamAsString(params.img_alt),
    img_title: getParamAsString(params.img_title),
    pdesc: getParamAsString(params.pdesc),
    cname: getParamAsString(params.cname),
    stime: getParamAsString(params.stime),
  };

  // If image is provided and is not a local file URI, construct full URL.
  const initialFullImageUrl =
    normalizedParams.image && !normalizedParams.image.startsWith("file://")
      ? getFullImageUrl(normalizedParams.image)
      : null;

  // Initialize state.
  const [image, setImage] = useState<string | null>(initialFullImageUrl);
  const [form, setForm] = useState({
    originalImage: normalizedParams.image || "",
    image: initialFullImageUrl || "",
    pname: normalizedParams.pname,
    aname: normalizedParams.aname,
    img_alt: normalizedParams.img_alt,
    img_title: normalizedParams.img_title,
    pdesc: normalizedParams.pdesc,
  });

  // Fetch post details if a valid image param was not provided.
  useEffect(() => {
    if (
      (!normalizedParams.image ||
        normalizedParams.image.startsWith("file://")) &&
      normalizedParams.id
    ) {
      console.log(
        "No valid image param provided. Fetching post details for ID:",
        normalizedParams.id
      );
      fetch(`${BASE_URL}/api/get-posts/${normalizedParams.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.pimage) {
            const fetchedImage = data.pimage;
            const fullUrl = getFullImageUrl(fetchedImage);
            setImage(fullUrl);
            setForm((prevForm) => ({
              ...prevForm,
              image: fullUrl || "",
              originalImage: fetchedImage,
              pname: data.pname,
              aname: data.aname,
              img_alt: data.img_alt,
              img_title: data.img_title,
              pdesc: data.pdesc,
              cname: data.cname,
            }));
          } else {
            console.log("No image found in fetched data");
          }
        })
        .catch((error) => {
          console.error("Error fetching post details:", error);
        });
    }
  }, [normalizedParams.image, normalizedParams.id]);

  useEffect(() => {
    console.log("Received image param:", normalizedParams.image);
    console.log("Full image URL:", image);
  }, [normalizedParams.image, image]);

  // Fetch actual categories from the server instead of using dummy data.
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${BASE_URL}/api/categories`)
      .then((res) => res.json())
      .then((data) => {
        // Assuming the API returns an array of objects with a "name" property.
        const catNames = data.map((cat: any) => cat.name);
        setCategories(catNames);
      })
      .catch((err) => {
        console.error("Error fetching categories:", err);
      });
  }, []);

  const [selectedCategory, setSelectedCategory] = useState(
    normalizedParams.cname || ""
  );
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [imageChanged, setImageChanged] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Register for notifications.
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

  async function registerForPushNotifications() {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notifications!");
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
      alert("Permission to access the media library is required!");
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
      console.log("Selected new image URI:", selectedImageUri);
      setImage(selectedImageUri);
      setForm((prevForm) => ({
        ...prevForm,
        image: selectedImageUri,
      }));
      setImageChanged(true);
    }
  };

  // Submit update function.
  const submitUpdate = async () => {
    try {
      console.log("Starting update with id:", normalizedParams.id);
      let body;
      let headers: HeadersInit = {};

      if (imageChanged && form.image.startsWith("file://")) {
        const formData = new FormData();
        formData.append("file", {
          uri: form.image,
          name: "upload.jpg",
          type: "image/jpeg",
        } as any);
        formData.append("id", normalizedParams.id);
        formData.append("pname", form.pname);
        formData.append("aname", form.aname);
        formData.append("img_alt", form.img_alt);
        formData.append("img_title", form.img_title);
        formData.append("pdesc", form.pdesc);
        formData.append("cname", selectedCategory);
        formData.append(
          "up_date",
          !normalizedParams.stime || normalizedParams.stime.trim() === ""
            ? new Date().toISOString()
            : ""
        );
        formData.append("stime", normalizedParams.stime);
        body = formData;
      } else {
        let imagePathForServer = form.originalImage;
        if (form.image && !form.image.startsWith("file://")) {
          imagePathForServer = form.image;
        }
        // Import config at the top of your file

        // Then update your conditional code
        if (imagePathForServer.includes(config.apiUrl)) {
          // Extract just the path portion by removing the base URL
          const urlObj = new URL(imagePathForServer);
          imagePathForServer = urlObj.pathname;
        } else if (imagePathForServer.includes("172.20.10.4:5000")) {
          // Keep the old logic as a fallback for backward compatibility
          imagePathForServer = imagePathForServer.split("172.20.10.4:5000")[1];
        }
        body = JSON.stringify({
          id: normalizedParams.id,
          image: imagePathForServer,
          pname: form.pname,
          aname: form.aname,
          img_alt: form.img_alt,
          img_title: form.img_title,
          pdesc: form.pdesc,
          cname: selectedCategory,
          up_date:
            !normalizedParams.stime || normalizedParams.stime.trim() === ""
              ? new Date().toISOString()
              : null,
          stime: normalizedParams.stime,
        });
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${BASE_URL}/api/update-post`, {
        method: "PUT",
        headers,
        body,
      });

      const responseText = await response.text();
      console.log("Raw response text:", responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error("Failed to parse JSON response: " + responseText);
      }

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to update post");
      }
      console.log("Post updated successfully:", responseData);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Post Updated!",
          body: "Your post has been updated successfully.",
        },
        trigger: null,
      });
      router.back();
    } catch (error) {
      console.error("Error updating post:", error);
      alert(
        "Error updating post: " +
          (error instanceof Error ? error.message : String(error))
      );
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
            <Text style={styles.headerTitle}>Edit Post</Text>
          </View>
        </LinearGradient>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Upload & Preview */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.imageUploadButton}
              onPress={pickImage}
            >
              <Ionicons name="image" size={24} color="#1a8e2d" />
              <Text style={styles.imageUploadText}>
                {image ? "Change Image" : "Upload Image"}
              </Text>
            </TouchableOpacity>
            {image && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: image }}
                  style={styles.image}
                  onLoad={() =>
                    console.log("✅ Image loaded successfully:", image)
                  }
                  onError={(e) =>
                    console.error("❌ Image failed to load:", {
                      uri: image,
                      error: e.nativeEvent.error,
                    })
                  }
                />
                <Text style={styles.debugText} numberOfLines={2}>
                  {image ? image.substring(0, 50) + "..." : "none"}
                </Text>
              </View>
            )}
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
                {categories.length > 0 ? (
                  categories.map((cat, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{cat}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.dropdownOptionText}>
                    Loading categories...
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer with Preview and Update Buttons */}
      <View style={styles.footer}>
        <View style={styles.footerButtonsContainer}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setShowPreviewModal(true)}
          >
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postButton} onPress={submitUpdate}>
            <Text style={styles.postButtonText}>Update</Text>
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
    </View>
  );
}

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
  label: { fontSize: 16, color: "#333", marginBottom: 5 },
  input: {
    backgroundColor: "white",
    borderRadius: 16,
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
  imageContainer: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
    marginTop: 10,
    borderRadius: 8,
  },
  debugText: {
    fontSize: 10,
    color: "#666",
    marginTop: 5,
    paddingHorizontal: 10,
  },
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
});

export {};
