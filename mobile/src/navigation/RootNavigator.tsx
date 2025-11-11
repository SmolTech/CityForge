import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../contexts/AuthContext";
import type { RootStackParamList } from "../types/navigation";

// Import navigators and screens
import MainTabNavigator from "./MainTabNavigator";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import InstanceManagerScreen from "../screens/InstanceManagerScreen";
import AddInstanceScreen from "../screens/AddInstanceScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // TODO: Add a proper loading screen
    return null;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="InstanceManager"
            component={InstanceManagerScreen}
            options={{ headerShown: true, title: "Manage Instances" }}
          />
          <Stack.Screen
            name="AddInstance"
            component={AddInstanceScreen}
            options={{ headerShown: true, title: "Add Instance" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: true, title: "Login" }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: true, title: "Register" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
