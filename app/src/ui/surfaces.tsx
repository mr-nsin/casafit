import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Text, Touchable, type IconName } from './primitives';
import { radius, space, type ColorKey } from './tokens';
import { useTokens } from './useTokens';

type Tone = 'pc' | 'sc' | 'tc' | 'c3' | 'c4' | 'erc';
const onTone: Record<Tone, ColorKey> = { pc: 'opc', sc: 'osc', tc: 'otc', c3: 'on', c4: 'on', erc: 'eoc' };

export function Card({ tone = 'c3', children, style, radiusSize = radius.xl }: { tone?: Tone; children: React.ReactNode; style?: StyleProp<ViewStyle>; radiusSize?: number }) {
  const t = useTokens();
  return <View style={[{ backgroundColor: t[tone], borderRadius: radiusSize, padding: space.l }, style]}>{children}</View>;
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="title" color="p" accessibilityRole="header" style={{ fontSize: 14, paddingVertical: space.s }}>
      {title}
    </Text>
  );
}

export function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {hint ? (
        <Text variant="bodySmall" color="osv">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export type ListRowProps = {
  icon?: IconName;
  title: string;
  subtitle?: string;
  trailing?: 'chevron' | 'external' | string | React.ReactNode;
  onPress?: () => void;
  tone?: Tone;
  destructive?: boolean;
  minHeight?: number;
  testID?: string;
};

export function ListRow({ icon, title, subtitle, trailing = 'chevron', onPress, tone, destructive, minHeight = 64, testID }: ListRowProps) {
  const t = useTokens();
  const color: ColorKey = destructive ? 'er' : tone ? onTone[tone] : 'on';
  const trail =
    trailing === 'chevron' ? <Icon name="chevron_right" color="osv" /> : trailing === 'external' ? <Icon name="open_in_new" color="osv" /> : typeof trailing === 'string' ? <Text color="osv">{trailing}</Text> : trailing;
  return (
    <Touchable
      label={subtitle ? `${title}, ${subtitle}` : title}
      testID={testID}
      onPress={onPress}
      minSize={minHeight}
      style={{
        minHeight,
        borderRadius: radius.l,
        backgroundColor: tone ? t[tone] : 'transparent',
        paddingHorizontal: space.l,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.l,
      }}
    >
      {icon ? <Icon name={icon} color={destructive ? 'er' : 'osv'} /> : null}
      <View style={{ flex: 1 }}>
        <Text color={color}>{title}</Text>
        {subtitle ? (
          <Text variant="bodySmall" color={tone ? onTone[tone] : 'osv'}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trail}
    </Touchable>
  );
}

export function StatTile({ value, label, suffix, tone = 'c3', style }: { value: string | number; label: string; suffix?: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const t = useTokens();
  const fg = onTone[tone];
  return (
    <View accessible accessibilityLabel={`${value}${suffix ? ` ${suffix}` : ''}, ${label}`} style={[{ flex: 1, backgroundColor: t[tone], borderRadius: radius.xl, padding: space.l, gap: space.xs }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
        <Text variant="headline" color={fg} tabular>
          {value}
        </Text>
        {suffix ? (
          <Text variant="bodySmall" color={fg}>
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text variant="bodySmall" color={fg}>
        {label}
      </Text>
    </View>
  );
}

/** Icon and text on c3. */
export function InfoNote({ icon = 'info', text, tone = 'c3' }: { icon?: IconName; text: string; tone?: Tone }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: space.m, backgroundColor: t[tone], borderRadius: radius.l, padding: space.l, alignItems: 'flex-start' }}>
      <Icon name={icon} color={onTone[tone]} />
      <Text variant="bodySmall" color={onTone[tone]} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
export const InfoRow = ({ icon, text, tone = 'neutral' }: { icon: IconName; text: string; tone?: 'neutral' | 'success' }) => (
  <InfoNote icon={icon} text={text} tone={tone === 'success' ? 'tc' : 'c3'} />
);
export const PrivacyNote = ({ text }: { text: string }) => <InfoNote icon="lock" text={text} />;
export const TipCard = ({ icon = 'lightbulb', text, onPress }: { icon?: IconName; text: string; onPress?: () => void }) =>
  onPress ? <ListRow icon={icon} title={text} onPress={onPress} tone="c3" /> : <InfoNote icon={icon} text={text} tone="tc" />;

export type BannerVariant = 'info' | 'error' | 'neutral' | 'medical' | 'status' | 'plain' | 'warning';

/** Status banner. error/warning/medical announce as alerts, the rest as notes. */
export function StatusBanner({ variant = 'info', icon, children }: { variant?: BannerVariant; icon?: IconName; children: React.ReactNode }) {
  const t = useTokens();
  const map: Record<BannerVariant, { tone: Tone; icon: IconName }> = {
    info: { tone: 'sc', icon: 'info' },
    error: { tone: 'erc', icon: 'error' },
    warning: { tone: 'erc', icon: 'warning' },
    medical: { tone: 'erc', icon: 'medical_services' },
    neutral: { tone: 'c3', icon: 'info' },
    status: { tone: 'tc', icon: 'check_circle' },
    plain: { tone: 'c3', icon: 'info' },
  };
  const m = map[variant];
  const alert = variant === 'error' || variant === 'warning';
  return (
    <View
      accessible
      accessibilityRole={alert ? 'alert' : 'text'}
      accessibilityLiveRegion={alert ? 'assertive' : 'polite'}
      style={{ flexDirection: 'row', gap: space.m, backgroundColor: t[m.tone], borderRadius: radius.l, padding: space.l, alignItems: 'flex-start' }}
    >
      {variant === 'plain' ? null : <Icon name={icon ?? m.icon} color={onTone[m.tone]} />}
      <Text variant="bodySmall" color={onTone[m.tone]} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}
export const InfoBanner = (p: { children: React.ReactNode; icon?: IconName }) => <StatusBanner variant="info" {...p} />;
export const WarningBanner = ({ text, icon = 'warning' }: { text: string; icon?: IconName }) => (
  <StatusBanner variant="warning" icon={icon}>
    {text}
  </StatusBanner>
);

export function StatusCard({ title, items, tone = 'tc' }: { title: string; items: string[]; tone?: Tone }) {
  const t = useTokens();
  return (
    <View style={{ backgroundColor: t[tone], borderRadius: radius.xxl, padding: space.xl, gap: space.m }}>
      <Text variant="title" color={onTone[tone]}>
        {title}
      </Text>
      {items.map((it) => (
        <View key={it} style={{ flexDirection: 'row', gap: space.m }}>
          <Icon name="check_circle" size={20} color={onTone[tone]} />
          <Text variant="bodySmall" color={onTone[tone]} style={{ flex: 1 }}>
            {it}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function IconBadge({ icon, size = 96, shape = 'circle', tone = 'pc' }: { icon: IconName; size?: number; shape?: 'circle' | 'squircle'; tone?: Tone }) {
  const t = useTokens();
  return (
    <View style={{ width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : size * 0.3, backgroundColor: t[tone], alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={onTone[tone]} />
    </View>
  );
}

export function Badge({ label, tone = 'tc' }: { label: string; tone?: Tone }) {
  const t = useTokens();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: t[tone], borderRadius: radius.s, paddingHorizontal: space.m, paddingVertical: space.xs }}>
      <Text variant="labelStrong" color={onTone[tone]}>
        {label}
      </Text>
    </View>
  );
}
export const StatusChip = Badge;

export function VerdictChip({ verdict, topic }: { verdict: 'false' | 'partly' | 'true'; topic?: string }) {
  const map = { false: { l: 'False', i: 'close', tone: 'erc' }, partly: { l: 'Partly true', i: 'remove', tone: 'sc' }, true: { l: 'True', i: 'check', tone: 'tc' } } as const;
  const m = map[verdict];
  const t = useTokens();
  return (
    <View accessible accessibilityLabel={`${m.l}${topic ? `, ${topic}` : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', backgroundColor: t[m.tone], borderRadius: radius.s, paddingHorizontal: space.m, paddingVertical: space.xs }}>
      <Icon name={m.i} size={16} color={onTone[m.tone]} />
      <Text variant="labelStrong" color={onTone[m.tone]}>
        {m.l}
        {topic ? ` · ${topic}` : ''}
      </Text>
    </View>
  );
}

export function ChecklistItem({ state, label, icon, tone = 'c3' }: { state: 'done' | 'active' | 'pending'; label: string; icon?: IconName; tone?: Tone }) {
  const t = useTokens();
  const name = icon ?? (state === 'done' ? 'check_circle' : state === 'active' ? 'pending' : 'radio_button_unchecked');
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${state === 'done' ? 'done' : state === 'active' ? 'in progress' : 'waiting'}`}
      style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.m, backgroundColor: t[tone], borderRadius: radius.l, paddingHorizontal: space.l, opacity: state === 'pending' ? 0.6 : 1 }}
    >
      <Icon name={name} color={state === 'done' ? 'p' : 'osv'} />
      <Text color={onTone[tone]} style={{ flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space.m, padding: space.xxl }}>
      <IconBadge icon={icon} size={96} />
      <Text variant="headline" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text color="osv" style={{ textAlign: 'center' }}>
        {body}
      </Text>
      {children}
    </View>
  );
}

export function BenefitRow({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.l, alignItems: 'flex-start', minHeight: 44 }}>
      <IconBadge icon={icon} size={40} shape="squircle" tone="sc" />
      <View style={{ flex: 1 }}>
        <Text>{title}</Text>
        {body ? (
          <Text variant="bodySmall" color="osv">
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Free form checks left: chip (e.g. "2 of 2") or two tiles. */
export function CreditBadge({ remaining, total = 2, variant = 'chip' }: { remaining: number | 'unlimited'; total?: number; variant?: 'chip' | 'tiles' }) {
  const t = useTokens();
  const text = remaining === 'unlimited' ? 'Unlimited form checks' : `${remaining} of ${total} free form checks left`;
  if (variant === 'tiles' && remaining !== 'unlimited') {
    return (
      <View accessible accessibilityLabel={text} style={{ alignItems: 'center', gap: space.m }}>
        <View style={{ flexDirection: 'row', gap: space.m }}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ width: 64, height: 64, borderRadius: radius.l, backgroundColor: i < remaining ? t.pc : t.c4, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="photo_camera" color={i < remaining ? 'opc' : 'ol'} />
            </View>
          ))}
        </View>
        <Text variant="bodySmall" color="osv">
          {text}
        </Text>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel={text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, backgroundColor: t.tc, borderRadius: radius.s, paddingHorizontal: space.m, minHeight: 32 }}>
      <Icon name="photo_camera" size={16} color="otc" />
      <Text variant="labelStrong" color="otc" tabular>
        {remaining === 'unlimited' ? 'Unlimited' : `${remaining} of ${total}`}
      </Text>
    </View>
  );
}

/** Radio card for Paywall plans. */
export function PaywallPlanCard({ title, price, caption, badge, selected, onSelect }: { title: string; price: string; caption?: string; badge?: string; selected: boolean; onSelect: () => void }) {
  const t = useTokens();
  return (
    <Touchable
      role="radio"
      label={`${title}, ${price}${caption ? `, ${caption}` : ''}`}
      selected={selected}
      onPress={onSelect}
      style={{ minHeight: 72, borderRadius: radius.xl, borderWidth: selected ? 2 : 1, borderColor: selected ? t.p : t.olv, backgroundColor: selected ? t.pc : 'transparent', padding: space.l, flexDirection: 'row', alignItems: 'center', gap: space.m }}
    >
      <Icon name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} color={selected ? 'p' : 'osv'} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" color={selected ? 'opc' : 'on'}>
          {title}
        </Text>
        {caption ? (
          <Text variant="bodySmall" color={selected ? 'opc' : 'osv'}>
            {caption}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.xs }}>
        <Text variant="title" tabular color={selected ? 'opc' : 'on'}>
          {price}
        </Text>
        {badge ? <Badge label={badge} /> : null}
      </View>
    </Touchable>
  );
}

export function Avatar({ initials, size = 72, onEdit }: { initials: string; size?: number; onEdit?: () => void }) {
  const t = useTokens();
  const body = (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.pc, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="headline" color="opc">
        {initials}
      </Text>
    </View>
  );
  return onEdit ? (
    <Touchable label="Change profile photo" onPress={onEdit} minSize={size} style={{ borderRadius: size / 2 }}>
      {body}
    </Touchable>
  ) : (
    <View accessible accessibilityLabel={`Profile, ${initials}`}>{body}</View>
  );
}

export function NotificationPreview({ appName, time, title, body }: { appName: string; time: string; title: string; body: string }) {
  const t = useTokens();
  return (
    <View accessible accessibilityLabel={`Preview: ${appName}, ${time}. ${title}. ${body}`} style={{ backgroundColor: t.c4, borderRadius: radius.l, padding: space.l, gap: space.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label" color="osv">
          {appName}
        </Text>
        <Text variant="label" color="osv" tabular>
          {time}
        </Text>
      </View>
      <Text variant="title">{title}</Text>
      <Text variant="bodySmall" color="osv">
        {body}
      </Text>
    </View>
  );
}

/** Collapsible FAQ row using native disclosure semantics. */
export function Accordion({ question, answer, expanded, onToggle }: { question: string; answer: string; expanded: boolean; onToggle: () => void }) {
  return (
    <View>
      <Touchable label={question} expanded={expanded} onPress={onToggle} minSize={56} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.l }}>
        <Text style={{ flex: 1 }}>{question}</Text>
        <Icon name={expanded ? 'expand_less' : 'expand_more'} color="osv" />
      </Touchable>
      {expanded ? (
        <Text variant="bodySmall" color="osv" style={{ paddingHorizontal: space.l, paddingBottom: space.m }}>
          {answer}
        </Text>
      ) : null}
    </View>
  );
}

export function BigTimer({ seconds, caption }: { seconds: number; caption?: string }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const text = m > 0 ? `${m}:${String(s).padStart(2, '0')}` : String(s);
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={`${seconds} seconds${caption ? `, ${caption}` : ''}`} style={{ alignItems: 'center' }}>
      <Text variant="timer" tabular>
        {text}
      </Text>
      {caption ? (
        <Text color="osv">{caption}</Text>
      ) : null}
    </View>
  );
}
