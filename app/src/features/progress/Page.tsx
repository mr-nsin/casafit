import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useTokens } from '../../ui';

/** Screen frame: background, safe area, scrolling body, optional pinned footer. */
export function Page({ top, children, footer }: { top?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const t = useTokens();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {top}
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: space.xxl }}>{children}</ScrollView>
      {footer ? <View style={{ padding: space.l, gap: space.s }}>{footer}</View> : null}
    </SafeAreaView>
  );
}
