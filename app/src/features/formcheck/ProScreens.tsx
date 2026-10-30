// Paywall, ManagePro and ProWelcome (m3-paywall, m3-managepro, m3-prowelcome). Prices are only
// ever the store's own strings from the purchases port.

import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, BackHandler, View } from 'react-native';

import {
  Badge,
  BenefitRow,
  Card,
  FilledButton,
  HeroIllustration,
  Icon,
  InfoRow,
  ListRow,
  OutlinedButton,
  PaywallPlanCard,
  StatusBanner,
  Text,
  TextButton,
  radius,
  space,
  useTokens,
} from '../../ui';
import {
  PurchasesUnavailableError,
  getPurchases,
  packageFor,
  proStatus,
  savePercent,
  type Offerings,
  type ProInfo,
  type ProPlan,
  type UnavailableReason,
} from '../../services/purchases';
import { Page } from './components';
import { getFormCheckDeps } from './deps';
import { useEntitlements, useProStatus } from './entitlements';
import { resolveFormCheckEntry } from './gate';
import { useBackOrHome, useEntitlementsLoaded, useFormNav } from './hooks';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const PLAN_LABEL: Record<ProPlan, string> = { pro_yearly: 'Yearly', pro_monthly: 'Monthly' };

type Load = { kind: 'loading' } | { kind: 'ready'; offerings: Offerings } | { kind: 'unavailable'; reason: UnavailableReason };
type Buy = { kind: 'idle' } | { kind: 'purchasing' } | { kind: 'cancelled' } | { kind: 'pending' } | { kind: 'error'; message: string };
type Restore = { kind: 'idle' } | { kind: 'restoring' } | { kind: 'none' } | { kind: 'error' };

const reasonOf = (e: unknown): UnavailableReason => (e instanceof PurchasesUnavailableError ? e.reason : 'failed');

// --- Paywall ------------------------------------------------------------------------------

export function PaywallScreen() {
  const nav = useFormNav();
  const back = useBackOrHome();
  const ent = useEntitlementsLoaded();
  const status = useProStatus();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [plan, setPlan] = useState<ProPlan>('pro_yearly');
  const [buy, setBuy] = useState<Buy>({ kind: 'idle' });
  const [restore, setRestore] = useState<Restore>({ kind: 'idle' });

  const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true;
    getPurchases()
      .getOfferings()
      .then((o) => live && setLoad(o.packages.length ? { kind: 'ready', offerings: o } : { kind: 'unavailable', reason: 'failed' }))
      .catch((e) => live && setLoad({ kind: 'unavailable', reason: reasonOf(e) }));
    return () => {
      live = false;
    };
  }, [tries]);
  const retryOfferings = () => {
    setLoad({ kind: 'loading' });
    setTries((n) => n + 1);
  };

  // Already Pro: nothing to sell, show the subscription instead.
  useEffect(() => {
    if (status.active) nav.replace('ManagePro');
  }, [status.active, nav]);

  const offerings = load.kind === 'ready' ? load.offerings : null;
  const yearly = offerings ? packageFor(offerings, 'pro_yearly') : undefined;
  const monthly = offerings ? packageFor(offerings, 'pro_monthly') : undefined;
  const pct = offerings ? savePercent(offerings) : null;
  const chosen = plan === 'pro_yearly' ? (yearly ?? monthly) : (monthly ?? yearly);

  const start = async () => {
    if (!chosen) return;
    setBuy({ kind: 'purchasing' });
    try {
      const r = await getPurchases().purchase(chosen);
      if (r.kind === 'purchased') {
        await useEntitlements.getState().applyPro(r.info);
        useEntitlements.getState().setWelcomeKind('purchase');
        setBuy({ kind: 'idle' });
        nav.replace('ProWelcome');
      } else setBuy(r.kind === 'error' ? { kind: 'error', message: r.message } : { kind: r.kind });
    } catch (e) {
      setBuy({ kind: 'error', message: reasonOf(e) === 'offline' ? 'You seem to be offline. Try again when you are connected.' : 'The store could not finish the purchase.' });
    }
  };

  const restorePurchase = async () => {
    setRestore({ kind: 'restoring' });
    try {
      const info = await getPurchases().restore();
      if (proStatus(info, getFormCheckDeps().now()).active) {
        await useEntitlements.getState().applyPro(info);
        useEntitlements.getState().setWelcomeKind('restore');
        setRestore({ kind: 'idle' });
        nav.replace('ProWelcome');
      } else setRestore({ kind: 'none' });
    } catch {
      setRestore({ kind: 'error' });
    }
  };

  const used = Math.max(0, 2 - ent.freeChecks);
  const usedLine = used >= 2 ? 'You have used both free checks. Free checks never expire.' : `You have used ${used} of your 2 free checks. Free checks never expire.`;
  const purchasing = buy.kind === 'purchasing';

  return (
    <Page
      topBar={{ leading: 'close', onLeading: back }}
      footer={
        <>
          <FilledButton label="Start Pro" loading={purchasing} disabled={load.kind !== 'ready' || !chosen} onPress={() => void start()} />
          <OutlinedButton label={restore.kind === 'restoring' ? 'Looking for your purchase...' : 'Restore purchase'} disabled={restore.kind === 'restoring' || purchasing} onPress={() => void restorePurchase()} />
          <TextButton label="Maybe later" onPress={back} />
        </>
      }
    >
      <View style={{ gap: space.s }}>
        <Text variant="labelStrong" color="p">
          CasaFit Pro
        </Text>
        <Text variant="headline" accessibilityRole="header">
          Check your form, as often as you like
        </Text>
      </View>
      <View style={{ gap: space.l }}>
        <BenefitRow icon="photo_camera" title="Unlimited form checks" body="Squat, push-up, plank and lunge. On your phone." />
        <BenefitRow icon="lock" title="Still private" body="Pro checks never record or upload anything." />
        <BenefitRow icon="restore" title="Restores on any phone" body="Verify your number and Pro is back." />
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Plans" style={{ gap: space.s }}>
        {load.kind === 'loading' ? (
          <View accessible accessibilityLabel="Loading plans" accessibilityLiveRegion="polite" style={{ gap: space.s }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : null}
        {offerings && yearly ? (
          <PaywallPlanCard
            title="Yearly"
            price={yearly.priceString}
            caption={pct ? `Save ${pct}%` : undefined}
            badge={pct ? 'Best value' : undefined}
            selected={chosen?.plan === 'pro_yearly'}
            onSelect={() => setPlan('pro_yearly')}
          />
        ) : null}
        {offerings && monthly ? <PaywallPlanCard title="Monthly" price={monthly.priceString} selected={chosen?.plan === 'pro_monthly'} onSelect={() => setPlan('pro_monthly')} /> : null}
      </View>

      {load.kind === 'unavailable' ? (
        <View style={{ gap: space.s }}>
          <StatusBanner variant="info" icon="cloud_off">
            {load.reason === 'unconfigured'
              ? 'Pro is not available on this build yet. Your free checks and training are not affected.'
              : 'Plans are not available right now. Check your connection and try again.'}
          </StatusBanner>
          {load.reason === 'unconfigured' ? null : <OutlinedButton label="Try again" leadingIcon="refresh" onPress={retryOfferings} />}
        </View>
      ) : null}

      {buy.kind === 'cancelled' ? <StatusBanner variant="plain">No problem. You have not been charged.</StatusBanner> : null}
      {buy.kind === 'pending' ? <StatusBanner variant="info">Your purchase is pending. Pro turns on as soon as the store confirms it.</StatusBanner> : null}
      {buy.kind === 'error' ? <StatusBanner variant="error">{buy.message}</StatusBanner> : null}
      {restore.kind === 'none' ? <StatusBanner variant="plain">No purchase found for this store account.</StatusBanner> : null}
      {restore.kind === 'error' ? <StatusBanner variant="error">We could not reach the store. Try again in a moment.</StatusBanner> : null}

      <InfoRow icon="info" text={usedLine} />
      <Text variant="label" color="osv">
        {"Renews automatically until you cancel it in your store's subscription settings."}
      </Text>
    </Page>
  );
}

function SkeletonCard() {
  const t = useTokens();
  return <View style={{ minHeight: 72, borderRadius: radius.xl, backgroundColor: t.c3 }} />;
}

// --- ManagePro ----------------------------------------------------------------------------

type Note = { kind: 'restored' } | { kind: 'none' } | { kind: 'error' } | null;

export function ManageProScreen() {
  const nav = useFormNav();
  const back = useBackOrHome();
  const ent = useEntitlementsLoaded();
  const status = useProStatus();
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const info = ent.pro;
  const offline = ent.offline;
  const t = useTokens();

  const openStore = async () => {
    try {
      await getPurchases().showManageSubscriptions();
    } catch {
      setNote({ kind: 'error' });
    }
  };

  const restore = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await getPurchases().restore();
      if (proStatus(r, getFormCheckDeps().now()).active) {
        await useEntitlements.getState().applyPro(r);
        setNote({ kind: 'restored' });
      } else setNote({ kind: 'none' });
    } catch {
      setNote({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!status.active || !info) {
    return (
      <Page topBar={{ title: 'CasaFit Pro', leading: 'back', onLeading: back }} footer={<FilledButton label="See Pro" onPress={() => nav.replace('Paywall')} />}>
        <InfoRow icon="info" text={`You are on the free plan. ${ent.freeChecks} free ${ent.freeChecks === 1 ? 'check is' : 'checks are'} left, and they never expire.`} />
      </Page>
    );
  }

  const plan = info.plan ? `Pro · ${PLAN_LABEL[info.plan]}` : 'Pro';
  const until = info.expiresAt ? formatDate(info.expiresAt) : null;
  const detail =
    status.state === 'trial'
      ? `Trial ends${until ? ` on ${until}` : ' soon'}`
      : status.state === 'active_cancelled'
        ? `Pro until ${until ?? 'the end of this period'}. It will not renew.`
        : `Renews${until ? ` on ${until}` : ''}${info.priceString ? ` · ${info.priceString}` : ''}`;
  const badge = status.state === 'trial' ? 'Trial' : status.state === 'active_cancelled' ? 'Ends soon' : status.state === 'billing_issue' ? 'Payment needed' : 'Active';
  const actionsOff = offline || busy;
  const other: ProPlan = info.plan === 'pro_monthly' ? 'pro_yearly' : 'pro_monthly';

  return (
    <Page topBar={{ title: 'CasaFit Pro', leading: 'back', onLeading: back }}>
      {status.state === 'billing_issue' ? (
        <StatusBanner variant="warning">Update your payment method to keep Pro. The store will keep trying for a few days.</StatusBanner>
      ) : null}

      <View style={{ backgroundColor: t.tc, borderRadius: radius.xxl, padding: space.xl, gap: space.s }}>
        <Badge label={badge} tone="pc" />
        <Text variant="headline" color="otc">
          {plan}
        </Text>
        <Text color="otc">{detail}</Text>
      </View>

      {offline || status.stale ? (
        <InfoRow icon="cloud_off" text={`${offline ? 'You are offline. ' : ''}Showing what we last knew${status.asOf ? `, as of ${formatDate(status.asOf)}` : ''}. Changes need a connection.`} />
      ) : null}

      <View style={{ gap: space.l }}>
        <BenefitRow icon="photo_camera" title="Unlimited form checks" body={`${ent.proChecksThisMonth} ${ent.proChecksThisMonth === 1 ? 'check' : 'checks'} used this month · still on this phone`} />
        <BenefitRow icon="devices" title="Works on any phone you verify" body="Verify the same number or email and Pro comes back." />
      </View>

      {note?.kind === 'restored' ? <StatusBanner variant="status">Pro restored.</StatusBanner> : null}
      {note?.kind === 'none' ? <StatusBanner variant="plain">No purchase found for this store account.</StatusBanner> : null}
      {note?.kind === 'error' ? <StatusBanner variant="error">We could not reach the store. Try again in a moment.</StatusBanner> : null}

      <View>
        {status.state === 'billing_issue' ? <ListRow icon="credit_card" title="Update payment method" trailing="external" onPress={actionsOff ? undefined : () => void openStore()} /> : null}
        <ListRow icon="restore" title="Restore purchase" onPress={actionsOff ? undefined : () => void restore()} />
        <ListRow icon="swap_horiz" title={`Switch to ${PLAN_LABEL[other].toLowerCase()}`} subtitle="Changes at your next renewal" trailing="external" onPress={actionsOff ? undefined : () => void openStore()} />
        {info.willRenew ? <ListRow icon="cancel" title="Cancel Pro" subtitle="Opens your store" trailing="external" onPress={actionsOff ? undefined : () => void openStore()} /> : null}
      </View>

      <Text variant="bodySmall" color="osv">
        {`Cancelling takes two taps and opens your store's subscription page. You keep Pro until ${until ?? 'the end of this period'}, and your ${ent.freeChecks} free ${ent.freeChecks === 1 ? 'check stays' : 'checks stay'} as ${ent.freeChecks === 1 ? 'it was' : 'they were'}.`}
      </Text>
    </Page>
  );
}

// --- ProWelcome ---------------------------------------------------------------------------

export function ProWelcomeScreen() {
  const nav = useFormNav();
  const ent = useEntitlements();
  const info: ProInfo | null = ent.pro;
  const restored = ent.welcomeKind === 'restore';
  const title = restored ? 'Pro is back' : "You're on Pro";

  const home = useCallback(() => nav.reset({ index: 0, routes: [{ name: 'Main' }] }), [nav]);

  // A spoken "success" without a haptic library: a live region plus an explicit announcement.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(title);
  }, [title]);

  // Hardware back goes home, never back to the paywall.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      home();
      return true;
    });
    return () => sub.remove();
  }, [home]);

  const until = info?.expiresAt ? formatDate(info.expiresAt) : null;
  const sub = info?.trial
    ? `Your trial ends${until ? ` on ${until}` : ' soon'}. Thank you for backing CasaFit.`
    : info?.plan && until
      ? `${PLAN_LABEL[info.plan]} plan · renews ${until}. Thank you for backing CasaFit.`
      : 'Thank you for backing CasaFit.';

  const tryCheck = async () => nav.replace(await resolveFormCheckEntry());

  return (
    <Page
      topBar={{ leading: 'none' }}
      footer={
        <>
          <FilledButton label="Try a form check" leadingIcon="photo_camera" onPress={() => void tryCheck()} />
          <OutlinedButton label="Back to home" onPress={home} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.l }}>
        <HeroIllustration>
          <Icon name="verified" size={72} color="opc" />
        </HeroIllustration>
        <View accessibilityLiveRegion="polite" accessible accessibilityLabel={title} style={{ alignItems: 'center' }}>
          <Text variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
            {title}
          </Text>
        </View>
        <Text color="osv" style={{ textAlign: 'center' }}>
          {sub}
        </Text>
      </View>
      <View style={{ gap: space.m }}>
        {[
          ['photo_camera', 'Unlimited form checks, still on your phone'],
          ['devices', 'Comes back on any phone you verify'],
          ['cancel', 'Cancel any time in two taps'],
        ].map(([icon, text]) => (
          <Card key={text} tone="c3">
            <View style={{ flexDirection: 'row', gap: space.m, alignItems: 'center' }}>
              <Icon name={icon!} color="p" />
              <Text style={{ flex: 1 }}>{text}</Text>
            </View>
          </Card>
        ))}
      </View>
    </Page>
  );
}
