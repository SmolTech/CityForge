import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { InstanceProvider } from "./src/contexts/InstanceContext";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import RootNavigator from "./src/navigation/RootNavigator";
import NetworkStatusBanner from "./src/components/NetworkStatusBanner";
import { useBusinessContactSync } from "./src/hooks/useBusinessContactSync";
import { useCommunityCalendarSync } from "./src/hooks/useCommunityCalendarSync";

function BusinessContactSyncEffect() {
  useBusinessContactSync();
  return null;
}

function CommunityCalendarSyncEffect() {
  useCommunityCalendarSync();
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <InstanceProvider>
          <AuthProvider>
            <BusinessContactSyncEffect />
            <CommunityCalendarSyncEffect />
            <NavigationContainer>
            <RootNavigator />
            <NetworkStatusBanner />
            <StatusBar style="auto" />
          </NavigationContainer>
        </AuthProvider>
      </InstanceProvider>
    </ThemeProvider>
  );
}
