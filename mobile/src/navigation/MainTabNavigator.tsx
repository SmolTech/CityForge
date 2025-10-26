import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { MainTabParamList } from "../types/navigation";

// Import screens (we'll create these next)
import BusinessScreen from "../screens/BusinessScreen";
import ResourcesScreen from "../screens/ResourcesScreen";
import SearchScreen from "../screens/SearchScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        headerStyle: {
          backgroundColor: "#3b82f6",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Tab.Screen
        name="Business"
        component={BusinessScreen}
        options={{
          title: "Directory",
          tabBarLabel: "Business",
        }}
      />
      <Tab.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{
          title: "Resources",
          tabBarLabel: "Resources",
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: "Search",
          tabBarLabel: "Search",
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          tabBarLabel: "Profile",
        }}
      />
    </Tab.Navigator>
  );
}
