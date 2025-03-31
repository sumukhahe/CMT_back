import { StackActions } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "@/components/ThemeContext";

export default function RootLayout() {
  return (
    <>
      <ThemeProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "white" },
            animation: "slide_from_right",
            header: () => null,
            navigationBarHidden: true,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="posts/add"
            options={{
              headerShown: false,
              headerBackTitle: "",
              title: "",
            }}
          />
        </Stack>
      </ThemeProvider>
    </>
  );
}
