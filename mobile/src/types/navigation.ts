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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
