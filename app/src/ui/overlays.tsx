import React from 'react';
import { Animated, Modal, Pressable, View } from 'react-native';
import { DestructiveButton, FilledButton, TextButton, TonalButton } from './buttons';
import { Icon, Text, type IconName } from './primitives';
import { fixed, radius, space } from './tokens';
import { useEntrance } from './useMotion';
import { useTokens } from './useTokens';

function Scrim({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Dismiss"
      onPress={onDismiss}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: fixed.scrim }}
    />
  );
}

/** Bottom sheet; motion `rise` plays once, collapses to instant under reduced motion. */
export function BottomSheet({ visible, title, onDismiss, children }: { visible: boolean; title: string; onDismiss: () => void; children?: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Scrim onDismiss={onDismiss} />
        <SheetBody title={title}>{children}</SheetBody>
      </View>
    </Modal>
  );
}

function SheetBody({ title, children }: { title: string; children?: React.ReactNode }) {
  const t = useTokens();
  const v = useEntrance();
  return (
    <Animated.View
      
      style={{
        backgroundColor: t.c2,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        padding: space.xxl,
        gap: space.l,
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      <View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: t.olv }} />
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Animated.View>
  );
}

export type DialogAction = { label: string; onPress: () => void; variant?: 'filled' | 'tonal' | 'destructive' | 'text'; icon?: IconName };

/** Alert dialog with stacked actions. */
export function ConfirmDialog({ visible, icon, title, body, actions, onDismiss }: { visible: boolean; icon?: IconName; title: string; body: string; actions: DialogAction[]; onDismiss?: () => void }) {
  const t = useTokens();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xxl }}>
        <Scrim onDismiss={onDismiss} />
        <View
          style={{ backgroundColor: t.c2, borderRadius: radius.xxl, padding: space.xxl, gap: space.l }}
        >
          {icon ? <Icon name={icon} size={32} color="p" style={{ alignSelf: 'center' }} /> : null}
          <Text variant="headline" accessibilityRole="header" style={{ textAlign: icon ? 'center' : 'left' }}>
            {title}
          </Text>
          <Text color="osv">{body}</Text>
          {actions.map((a) => {
            const B = a.variant === 'destructive' ? DestructiveButton : a.variant === 'tonal' ? TonalButton : a.variant === 'text' ? TextButton : FilledButton;
            return <B key={a.label} label={a.label} leadingIcon={a.icon} onPress={a.onPress} height={48} />;
          })}
        </View>
      </View>
    </Modal>
  );
}

/** Consent withdrawal sheet: states the purpose and the consequence, then confirms. */
export function ConsentSheet({ visible, purpose, consequence, onConfirm, onCancel }: { visible: boolean; purpose: string; consequence: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <BottomSheet visible={visible} title={`Turn off ${purpose}?`} onDismiss={onCancel}>
      <Text color="osv">{consequence}</Text>
      <FilledButton label="Turn off" onPress={onConfirm} height={48} />
      <TextButton label="Keep it on" onPress={onCancel} />
    </BottomSheet>
  );
}
