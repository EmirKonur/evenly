import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ClipboardPaste, ImageUp, PenLine } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { appDeps } from '@/data/ids';
import { useGroupLedger } from '@/data/useLiveQuery';
import { useReceiptDraft } from '@/features/receipt/draftStore';
import { ocrAvailable, ocrUnavailableReason, recognizeText } from '@/features/receipt/ocr';
import { readReview, ReceiptReview, type ReviewModel } from '@/features/receipt/ReceiptReview';
import type { GroupLedger } from '@/data/types';
import { cents, formatPlain, type CurrencyCode } from '@/money';
import { parseReceipt } from '@/receipt/parse';
import { Banner } from '@/ui/Banner';
import { Button } from '@/ui/Button';
import { haptics } from '@/ui/haptics';
import { ScanIllustration } from '@/ui/illustrations';
import { PressableScale } from '@/ui/PressableScale';
import { QueryFallback } from '@/ui/QueryFallback';
import { Screen } from '@/ui/Screen';
import { PageTitle, ScreenHeader } from '@/ui/ScreenHeader';
import { Surface } from '@/ui/Surface';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { radius, space, useTheme } from '@/ui/theme';

type Stage =
  | { kind: 'choose' }
  | { kind: 'paste'; text: string }
  | { kind: 'reading'; uri: string }
  | { kind: 'review'; model: ReviewModel; source: 'photo' | 'text' | 'manual' }
  | { kind: 'failed'; message: string };

function emptyModel(newId: () => string): ReviewModel {
  return {
    merchant: '',
    rows: [{ id: newId(), name: '', quantity: 1, priceText: '', assigneeIds: [] }],
    extras: { tax: '', tip: '', fees: '', discount: '' },
    printedTotal: null,
    includedTax: null,
    spentAt: null,
  };
}

function localNoon(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12).getTime();
}

function modelFromText(lines: string[], currency: CurrencyCode, newId: () => string): ReviewModel {
  const parsed = parseReceipt(lines, { currency });
  const text = (amount: number | null) => (amount ? formatPlain(cents(amount), currency) : '');
  return {
    merchant: parsed.merchant ?? '',
    rows: parsed.items.map((item) => ({
      id: newId(),
      name: item.name,
      quantity: item.quantity,
      priceText: formatPlain(item.price, currency),
      assigneeIds: [],
    })),
    extras: {
      tax: text(parsed.extras.tax),
      tip: text(parsed.extras.tip),
      fees: text(parsed.extras.fees),
      discount: text(parsed.extras.discount),
    },
    printedTotal: parsed.total,
    includedTax: parsed.taxIncluded ? parsed.tax : null,
    spentAt: parsed.date ? localNoon(parsed.date) : null,
  };
}

export default function Scan() {
  const { groupId, start } = useLocalSearchParams<{ groupId: string; start?: string }>();
  const state = useGroupLedger(groupId);
  if (state.status !== 'ready' || !state.data)
    return <QueryFallback state={state} missing={state.status === 'ready'} />;
  return <ScanFlow ledger={state.data} manual={start === 'manual'} />;
}

function ScanFlow({ ledger, manual }: { ledger: GroupLedger; manual: boolean }) {
  const groupId = ledger.group.id;
  const currency = ledger.group.currency;
  const draft = useReceiptDraft((s) => s.draft);
  const startDraft = useReceiptDraft((s) => s.start);
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>(() => {
    // Coming back to edit items keeps what was already typed and assigned.
    if (draft && draft.groupId === groupId && draft.items.length > 0) {
      const text = (amount: number) => (amount ? formatPlain(cents(amount), currency) : '');
      return {
        kind: 'review',
        source: 'manual',
        model: {
          merchant: draft.merchant ?? '',
          rows: draft.items.map((item) => ({
            ...item,
            priceText: formatPlain(item.price, currency),
          })),
          extras: {
            tax: text(draft.extras.tax),
            tip: text(draft.extras.tip),
            fees: text(draft.extras.fees),
            discount: text(draft.extras.discount),
          },
          printedTotal: draft.printedTotal,
          includedTax: draft.includedTax,
          spentAt: draft.spentAt,
        },
      };
    }
    return manual
      ? { kind: 'review', source: 'manual', model: emptyModel(appDeps.newId) }
      : { kind: 'choose' };
  });
  const groupHref = { pathname: '/groups/[groupId]', params: { groupId } } as const;

  const fromPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setStage({
            kind: 'failed',
            message:
              'Camera access is off for Evenly. Allow it in Settings, or choose a photo instead.',
          });
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 1,
        exif: false,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      setStage({ kind: 'reading', uri: asset.uri });
      const lines = await recognizeText(asset.uri);
      if (lines.join('').trim() === '') {
        setStage({
          kind: 'failed',
          message:
            'No text found in that photo. Try again in brighter light with the receipt flat, or paste the text.',
        });
        return;
      }
      haptics.success();
      setStage({
        kind: 'review',
        source: 'photo',
        model: modelFromText(lines, currency, appDeps.newId),
      });
    } catch (cause) {
      haptics.warning();
      setStage({
        kind: 'failed',
        message: cause instanceof Error ? cause.message : 'Could not read that photo.',
      });
    }
  };

  const continueToAssign = (model: ReviewModel) => {
    const parsed = readReview(model, currency);
    startDraft({
      groupId,
      expenseId: draft?.groupId === groupId ? draft.expenseId : null,
      origin: draft?.groupId === groupId ? draft.origin : 'group',
      merchant: model.merchant.trim() || null,
      spentAt: model.spentAt ?? draft?.spentAt ?? null,
      items: parsed.items,
      extras: parsed.extras,
      printedTotal: model.printedTotal,
      includedTax: model.includedTax,
    });
    haptics.tap();
    router.push({ pathname: '/groups/[groupId]/assign', params: { groupId } });
  };

  const review = stage.kind === 'review' ? readReview(stage.model, currency) : null;
  const reviewProblem = review
    ? review.items.length === 0
      ? 'Add at least one item.'
      : review.invalid.length > 0
        ? 'Fix the highlighted lines first.'
        : null
    : null;

  return (
    <Screen
      header={
        <ScreenHeader
          fallback={groupHref}
          title={stage.kind === 'review' ? 'Check the receipt' : undefined}
        />
      }
      footer={
        stage.kind === 'review' ? (
          <View style={styles.footer}>
            {reviewProblem ? (
              <Text variant="caption" tone="soft" align="center">
                {reviewProblem}
              </Text>
            ) : null}
            <Button
              label="Next: who had what"
              onPress={() => continueToAssign(stage.model)}
              disabled={reviewProblem !== null}
              testID="review-continue"
            />
          </View>
        ) : stage.kind === 'paste' ? (
          <Button
            label="Read this text"
            disabled={!stage.text.trim()}
            onPress={() =>
              setStage({
                kind: 'review',
                source: 'text',
                model: modelFromText(stage.text.split('\n'), currency, appDeps.newId),
              })
            }
            testID="paste-read"
          />
        ) : undefined
      }
    >
      {stage.kind === 'choose' || stage.kind === 'failed' ? (
        <Animated.View entering={FadeIn} style={styles.stack}>
          <PageTitle
            title="Add a receipt"
            subtitle="Evenly reads the lines, then you tap who had what."
          />
          <View style={styles.illustration}>
            <ScanIllustration />
          </View>
          {stage.kind === 'failed' ? (
            <Banner tone="warning" title="That did not work">
              {stage.message}
            </Banner>
          ) : null}
          {ocrAvailable ? (
            <View style={styles.tiles}>
              <Tile
                icon={Camera}
                title="Take a photo"
                body="Read on this phone, never uploaded"
                onPress={() => fromPhoto('camera')}
                testID="scan-camera"
              />
              <Tile
                icon={ImageUp}
                title="Choose a photo"
                body="From your library"
                onPress={() => fromPhoto('library')}
                testID="scan-library"
              />
            </View>
          ) : (
            <Banner
              tone="info"
              title="Photo reading is not available here"
              testID="scan-unavailable"
            >
              {ocrUnavailableReason}
            </Banner>
          )}
          <View style={styles.tiles}>
            <Tile
              icon={ClipboardPaste}
              title="Paste text"
              body="From an emailed or online receipt"
              onPress={() => setStage({ kind: 'paste', text: '' })}
              testID="scan-paste"
            />
            <Tile
              icon={PenLine}
              title="Type items"
              body="Line by line"
              onPress={() =>
                setStage({ kind: 'review', source: 'manual', model: emptyModel(appDeps.newId) })
              }
              testID="scan-manual"
            />
          </View>
        </Animated.View>
      ) : null}

      {stage.kind === 'paste' ? (
        <View style={styles.stack}>
          <PageTitle
            title="Paste the receipt"
            subtitle="One line per row, as it appears on the receipt. Any language or number format."
          />
          <TextField
            label="Receipt text"
            hideLabel
            multiline
            value={stage.text}
            onChangeText={(text) => setStage({ kind: 'paste', text })}
            placeholder={'Bitoque  12,50\nSuper Bock  2,80\nTotal  15,30'}
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.paste}
            testID="paste-input"
          />
        </View>
      ) : null}

      {stage.kind === 'reading' ? (
        <View style={styles.reading} accessibilityLiveRegion="polite">
          <Surface padded={false} style={styles.thumbFrame}>
            <Image
              source={{ uri: stage.uri }}
              style={styles.thumb}
              contentFit="cover"
              accessibilityLabel="The receipt photo"
            />
          </Surface>
          <ActivityIndicator color={colors.primary} />
          <Text variant="body" tone="soft" align="center">
            Reading the receipt on this phone…
          </Text>
        </View>
      ) : null}

      {stage.kind === 'review' ? (
        <View style={styles.stack}>
          {stage.source === 'photo' ? (
            <Text variant="body" tone="soft">
              Compare with the paper receipt. Fix anything the camera misread.
            </Text>
          ) : null}
          <ReceiptReview
            model={stage.model}
            currency={currency}
            onChange={(model) => setStage({ ...stage, model })}
            newId={appDeps.newId}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Tile({
  icon: Icon,
  title,
  body,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={styles.tile}
      focusRadius={radius.lg}
      testID={testID}
    >
      <Surface style={styles.tileInner}>
        <View style={[styles.tileIcon, { backgroundColor: colors.highlight }]}>
          <Icon size={22} color="#2D1537" strokeWidth={2.25} />
        </View>
        <Text variant="subheading">{title}</Text>
        <Text variant="caption" tone="soft">
          {body}
        </Text>
      </Surface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  illustration: { alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1 },
  tileInner: { gap: space.xs, minHeight: 132 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  paste: { minHeight: 240, fontFamily: 'Nunito-SemiBold' },
  reading: { alignItems: 'center', gap: space.lg, paddingTop: space.xl },
  thumbFrame: { overflow: 'hidden' },
  thumb: { width: 200, height: 260 },
  footer: { gap: space.sm },
});
