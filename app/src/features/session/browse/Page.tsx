import React, { useContext } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../../app/types';
import { TopBar, space, useTokens, type TopBarProps } from '../../../ui';

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export const useBrowseNav = () => useNavigation<Nav>();

/** Safe area, optional top bar (or custom header), scrolling body and an optional sticky footer. */
export function Page({
  topBar,
  header,
  children,
  footer,
  tabRoot,
}: {
  topBar?: TopBarProps;
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** The tab bar already sits below this screen, so no bottom inset padding is added. */
  tabRoot?: boolean;
}) {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + space.s }}>
      {topBar ? <TopBar {...topBar} /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.l, flexGrow: 1 }}>
          {header}
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: space.l,
            paddingTop: space.s,
            paddingBottom: Math.max(tabRoot ? 0 : insets.bottom, space.l),
            gap: space.s,
            backgroundColor: t.bg,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** Back goes to the previous screen, or Home after a stack reset. */
export function useBackOrHome() {
  const nav = useBrowseNav();
  return () => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('Main');
  };
}
