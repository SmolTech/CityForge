import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Login: undefined;
  Register: undefined;
  CardDetail: { id: number };
  BusinessDetail: { slug: string };
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
