import type { NavigatorScreenParams } from "@react-navigation/native";
import type { Card } from "./api";

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Login: undefined;
  Register: undefined;
  CardDetail: { id: number };
  BusinessDetail: { id: number; slug?: string };
  BusinessForm:
    | { mode: "submit"; card?: undefined }
    | { mode: "edit"; card: Card };
  MySubmissions: undefined;
  InstanceManager: undefined;
  AddInstance: undefined;
};

export type MainTabParamList = {
  Business: undefined;
  Resources: undefined;
  Search: undefined;
  Profile: undefined;
};

declare global {
   
  namespace ReactNavigation {
     
    interface RootParamList extends RootStackParamList {}
  }
}
