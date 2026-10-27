import React, { useContext } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../app/types';
import { TopBar, space, useTokens, type TopBarProps } from '../../ui';

export type Nav = NativeStackNavigationProp<RootStackParamList>;
export const useOnboardingNav = () => useNavigation<Nav>();

/** Safe-area padding, optional top bar, scrolling body and a footer the keyboard pushes up. */
export function Layout({
  topBar,
  children,
  footer,
  scroll = true,
  background,
}: {
  topBar?: TopBarProps;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scroll?: boolean;
  background?: React.ReactNode;
}) {
  const t = useTokens();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const body = (
    <View style={{ paddingHorizontal: space.l, paddingBottom: space.l, gap: space.l, flexGrow: 1 }}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + space.s }}>
      {background}
      {topBar ? <TopBar {...topBar} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
            {body}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{body}</View>
        )}
        {footer ? (
          <View style={{ paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: Math.max(insets.bottom, space.xxl), gap: space.s }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Back goes to the previous screen, or to `fallback` when there is none (after a stack reset). */
export function useBack(fallback?: keyof RootStackParamList) {
  const nav = useOnboardingNav();
  return () => {
    if (nav.canGoBack()) nav.goBack();
    else if (fallback) nav.navigate(fallback as never);
  };
}

export const backProps = (nav: Nav, onBack: () => void): Pick<TopBarProps, 'leading' | 'onLeading'> => ({
  leading: nav.canGoBack() ? 'back' : 'none',
  onLeading: onBack,
});
