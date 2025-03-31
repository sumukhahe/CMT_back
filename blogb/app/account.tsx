import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Switch,
  Linking,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";

const { width } = Dimensions.get("window");
// Replace with your actual API URL
const API_BASE_URL = "http://172.20.10.4:5000";

const AccountSettingsScreen: React.FC = () => {
  // Profile states (removed profileImage)
  const [username, setUsername] = useState<string>("John Doe");

  // Dark mode toggle
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Password states
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchProfile();
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

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/get-profile?id=1`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server returned error:", errorText);
        throw new Error("Failed to fetch profile");
      }
      const data = await response.json();
      setUsername(data.username);
      setDarkMode(data.darkmode === 1);
    } catch (error) {
      console.error("Error fetching profile:", error);
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

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/update-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 1, // Replace with the actual user id
          currentPassword,
          newPassword,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert("Password changed successfully");
      } else {
        Alert.alert("Error", result.error || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      Alert.alert("Error updating password");
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordModal(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logged Out", "You have been logged out");
    router.push("/auth");
  };

  const handleSaveProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          darkMode,
          id: 1, // Use proper user id here
        }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert("Profile updated successfully!");
        fetchProfile();
      } else {
        Alert.alert("Error", result.error || "Failed to update profile.");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error updating profile");
    }
  };

  const handleDesktopView = () => {
    Linking.openURL("https://www.codemythought.com"); // Replace with your URL
  };

  return (
    <View style={[styles.container, darkMode && styles.darkContainer]}>
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
              <Ionicons name="chevron-back" size={28} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account Settings</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Username Field */}
        <View style={styles.inputSection}>
          <Text style={[styles.label, darkMode && styles.darkText]}>
            Username
          </Text>
          <TextInput
            style={[styles.input, darkMode && styles.darkInput]}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor={darkMode ? "#aaa" : "#999"}
          />
        </View>

        {/* Change Password Button */}
        <TouchableOpacity
          style={styles.optionButton}
          onPress={() => setShowPasswordModal(true)}
        >
          <Text style={styles.optionButtonText}>Change Password</Text>
        </TouchableOpacity>

        {/* Desktop View Option */}
        <TouchableOpacity
          style={styles.desktopButton}
          onPress={handleDesktopView}
        >
          <Text style={styles.optionButtonText}>Desktop View</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Save Changes Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={modalStyles.safeArea}>
          <KeyboardAvoidingView
            style={modalStyles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={modalStyles.modalOverlay}>
              <View style={modalStyles.modalContent}>
                {/* Modal Header */}
                <View style={modalStyles.modalHeader}>
                  <Text style={modalStyles.modalHeaderText}>
                    Change Password
                  </Text>
                  <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                    <Text style={modalStyles.closeIconText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Scrollable Content */}
                <ScrollView
                  contentContainerStyle={modalStyles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Current Password */}
                  <View style={modalStyles.inputContainer}>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="Current Password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showCurrentPassword}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                    >
                      <Ionicons
                        name={showCurrentPassword ? "eye" : "eye-off"}
                        size={24}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* New Password */}
                  <View style={modalStyles.inputContainer}>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="New Password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      <Ionicons
                        name={showNewPassword ? "eye" : "eye-off"}
                        size={24}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Confirm New Password */}
                  <View style={modalStyles.inputContainer}>
                    <TextInput
                      style={modalStyles.input}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#999"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      <Ionicons
                        name={showConfirmPassword ? "eye" : "eye-off"}
                        size={24}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                {/* Modal Footer */}
                <View style={modalStyles.buttonContainer}>
                  <TouchableOpacity
                    style={modalStyles.cancelButton}
                    onPress={() => setShowPasswordModal(false)}
                  >
                    <Text style={modalStyles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={modalStyles.saveButton}
                    onPress={handlePasswordChange}
                  >
                    <Text style={modalStyles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  darkContainer: { backgroundColor: "#333" },
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
  contentContainer: { padding: 20 },
  inputSection: { marginBottom: 20 },
  label: { fontSize: 16, color: "#333", marginBottom: 5 },
  darkText: { color: "#fff" },
  input: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 15,
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
  },
  darkInput: { backgroundColor: "#555", color: "#fff" },
  optionButton: {
    backgroundColor: "#1a8e2d",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  desktopButton: {
    backgroundColor: "#000",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  optionButtonText: { fontSize: 16, color: "white", fontWeight: "700" },
  logoutButton: {
    backgroundColor: "#d9534f",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  logoutButtonText: { fontSize: 16, color: "white", fontWeight: "700" },
  saveButton: {
    backgroundColor: "#007bff",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  saveButtonText: { fontSize: 16, color: "white", fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
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
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  closeIconText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  scrollContent: {
    padding: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: "#333",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  cancelButton: {
    backgroundColor: "#d9534f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  cancelButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#1a8e2d",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default AccountSettingsScreen;
