import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { ThemeTokens } from '../../../theme';
import useThemedStyles from '../../../hooks/useThemedStyles';
import Button from '../../../components/Button';
import { t } from '../../../i18n';
import { eventTypeLabel, itemCategoryLabel } from '../format';
import ItemThumb from './ItemThumb';
import PhotoCard from './PhotoCard';
import type { ClothingItem, OutfitRecommendation } from '../types';

interface Props {
  outfit: OutfitRecommendation;
  /** Feed card (with actions) or the detail screen's content (no action row). */
  layout?: 'chat' | 'detail';
  onView?: () => void;
  onToggleSave?: () => void;
  onRegenerate?: () => void;
  onItemPress?: (item: ClothingItem) => void;
  busy?: boolean;
  /** Hide match rows, note and item rows (the detail screen renders those itself). */
  hideMeta?: boolean;
  /** Render only the mosaic hero (used by the detail screen's full-bleed header). */
  heroOnly?: boolean;
  /** Override the hero height (defaults to a 3:4 main tile). */
  heroHeight?: number;
  /** Horizontal padding the card sits inside; used to size the mosaic. */
  horizontalInset?: number;
  /** Hide the overlaid save button and the frosted title strip on the hero. */
  hideHeroChips?: boolean;
}

const CATEGORY_ORDER = ['tops', 'dresses', 'jackets', 'bottoms', 'shoes', 'accessories'];

export function orderForHero(items: ClothingItem[]): ClothingItem[] {
  return [...items].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
}

/** "92% Breathable…" → { percent: 92, label: "Breathable…" }; otherwise percent is null. */
export function splitSuitability(text: string | undefined): { percent: number | null; label: string } {
  const value = (text ?? '').trim();
  const m = value.match(/^(\d{1,3})\s*%\s*(.*)$/);
  if (!m) return { percent: null, label: value };
  return { percent: Math.min(100, Math.max(0, Number(m[1]))), label: m[2].trim() };
}

const GAP = 8;
const TILE_RADIUS = 20;

interface MosaicProps {
  items: ClothingItem[];
  width: number;
  height: number;
  onItemPress?: (item: ClothingItem) => void;
  /** Drawn on the main tile's frosted strip. */
  mainCaption?: React.ReactNode;
  /** Drawn over the main tile's photo (chips, buttons). */
  mainOverlay?: React.ReactNode;
  mainStripHeight?: number;
}

/** Big main photo tile on the left (info on its frosted strip), two stacked squares on the right, "+N" on the last. */
export function OutfitMosaic({
  items,
  width,
  height,
  onItemPress,
  mainCaption,
  mainOverlay,
  mainStripHeight,
}: MosaicProps) {
  const styles = useThemedStyles(makeStyles);
  const ordered = orderForHero(items);
  const [main, second, third] = ordered;
  const extra = Math.max(0, ordered.length - 3);
  const hasSide = Boolean(second);
  const mainWidth = hasSide ? Math.round(width * 0.62) : width;
  const sideWidth = width - mainWidth - (hasSide ? GAP : 0);
  const sideHeight = third ? (height - GAP) / 2 : height;

  const sideTile = (item: ClothingItem, w: number, h: number, badge?: number) => (
    <PhotoCard
      key={item.id}
      item={item}
      width={w}
      height={h}
      radius={TILE_RADIUS}
      onPress={onItemPress ? () => onItemPress(item) : undefined}
      accessibilityLabel={item.name}
      overlay={
        badge ? (
          <View style={styles.moreOverlay} pointerEvents="none">
            <View style={styles.moreScrim} />
            <Text style={styles.moreText}>+{badge}</Text>
          </View>
        ) : undefined
      }
    />
  );

  if (!main) return null;
  return (
    <View style={[styles.mosaic, { width, height }]}>
      <PhotoCard
        item={main}
        width={mainWidth}
        height={height}
        radius={TILE_RADIUS}
        stripHeight={mainStripHeight ?? Math.round(height * 0.34)}
        overlay={mainOverlay}
        onPress={onItemPress ? () => onItemPress(main) : undefined}
        accessibilityLabel={main.name}
      >
        {mainCaption}
      </PhotoCard>
      {hasSide ? (
        <View style={[styles.mosaicSide, { width: sideWidth }]}>
          {sideTile(second, sideWidth, sideHeight, !third && extra ? extra : undefined)}
          {third ? sideTile(third, sideWidth, sideHeight, extra || undefined) : null}
        </View>
      ) : null}
    </View>
  );
}

interface MatchRowProps {
  label: string;
  text: string | undefined;
}

export function MatchRow({ label, text }: MatchRowProps) {
  const styles = useThemedStyles(makeStyles);
  if (!text || !text.trim()) return null;
  const { percent, label: detail } = splitSuitability(text);
  return (
    <View style={styles.matchRow}>
      <View style={styles.matchHead}>
        <Text style={styles.matchLabel}>{label}</Text>
        {percent !== null ? <Text style={styles.matchPercent}>{percent}%</Text> : null}
      </View>
      {percent !== null ? (
        <View style={styles.matchTrack}>
          <View style={[styles.matchFill, { width: `${percent}%` }]} />
        </View>
      ) : null}
      {detail ? <Text style={styles.matchDetail}>{detail}</Text> : null}
    </View>
  );
}

export function StylistQuote({ note }: { note: string | undefined }) {
  const styles = useThemedStyles(makeStyles);
  if (!note || !note.trim()) return null;
  return (
    <View style={styles.quoteWrap}>
      <Text style={styles.sectionHeading}>{t('style_pantry.why_it_works')}</Text>
      <View style={styles.quote}>
        <View style={styles.quoteBar} />
        <Text style={styles.quoteText}>{note}</Text>
      </View>
    </View>
  );
}

/** Magazine-style presentation of an outfit: photo mosaic with the title on a frosted strip, match meters, note, pieces. */
export default function OutfitShowcase({
  outfit,
  layout = 'chat',
  onView,
  onToggleSave,
  onRegenerate,
  onItemPress,
  busy,
  hideMeta,
  heroOnly,
  heroHeight,
  horizontalInset = 24,
  hideHeroChips,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - horizontalInset * 2;
  const height = heroHeight ?? Math.round(width * 0.62 * (4 / 3));
  const SaveIcon = outfit.isSaved ? BookmarkCheck : Bookmark;

  const caption = !hideHeroChips ? (
    <View>
      <Text style={styles.stripKicker}>{eventTypeLabel(outfit.occasion)}</Text>
      <Text style={styles.stripTitle} numberOfLines={2}>
        {outfit.title}
      </Text>
      <Text style={styles.stripSub} numberOfLines={1}>
        {outfit.eventTitle ? `${outfit.eventTitle} · ` : ''}
        {t('style_pantry.outfit_pieces', { count: outfit.items.length })}
      </Text>
    </View>
  ) : undefined;

  const overlay =
    !hideHeroChips && onToggleSave ? (
      <Pressable
        style={[styles.saveFab, outfit.isSaved && styles.saveFabOn, busy && styles.disabled]}
        onPress={onToggleSave}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={outfit.isSaved ? t('style_pantry.unsave_outfit') : t('style_pantry.save_outfit')}
        hitSlop={8}
      >
        <SaveIcon size={18} color={outfit.isSaved ? styles.onPrimary.color : styles.accent.color} />
      </Pressable>
    ) : undefined;

  const hero = (
    <View style={{ width, height }}>
      <OutfitMosaic
        items={outfit.items}
        width={width}
        height={height}
        onItemPress={onItemPress}
        mainCaption={caption}
        mainOverlay={overlay}
      />
    </View>
  );

  if (heroOnly) return hero;

  return (
    <View style={[styles.card, layout === 'detail' && styles.cardDetail]}>
      {hero}

      <View style={styles.body}>
        {!hideMeta ? (
          <>
            {outfit.weatherSuitability || outfit.occasionSuitability ? (
              <View style={styles.matchGroup}>
                <MatchRow label={t('style_pantry.match_weather')} text={outfit.weatherSuitability} />
                <MatchRow label={t('style_pantry.match_occasion')} text={outfit.occasionSuitability} />
              </View>
            ) : null}

            <StylistQuote note={outfit.stylistNote} />

            <View style={styles.itemList}>
              {orderForHero(outfit.items).map(item => (
                <Pressable
                  key={item.id}
                  style={styles.itemRow}
                  onPress={onItemPress ? () => onItemPress(item) : undefined}
                  disabled={!onItemPress}
                  accessibilityRole={onItemPress ? 'button' : undefined}
                  accessibilityLabel={item.name}
                >
                  <ItemThumb item={item} size={48} radius={14} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {itemCategoryLabel(item)} · {item.color}
                    </Text>
                  </View>
                  {onItemPress ? <ChevronRight size={16} color={styles.muted.color} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {layout === 'chat' && (onView || onRegenerate) ? (
          <View style={styles.actions}>
            {onView ? (
              <Button title={t('style_pantry.view_outfit_details')} onPress={onView} showArrow />
            ) : null}
            {onRegenerate ? (
              <Button
                title={t('style_pantry.new_look')}
                onPress={onRegenerate}
                variant="outline"
                loading={busy}
                disabled={busy}
                showArrow={false}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius, shadow, spacing }: ThemeTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: spacing.md,
      ...shadow.soft,
    },
    cardDetail: {
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: colors.background,
      marginBottom: 0,
    },
    accent: { color: colors.primary },
    onPrimary: { color: colors.textOnPrimary },
    muted: { color: colors.textMuted },
    disabled: { opacity: 0.55 },
    mosaic: { flexDirection: 'row', gap: GAP },
    mosaicSide: { gap: GAP },
    moreOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.primary, opacity: 0.55 },
    moreText: { fontFamily: fonts.sansBold, fontSize: 22, color: colors.textOnPrimary },
    stripKicker: {
      fontFamily: fonts.sansBold,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.textOnPrimaryMuted,
    },
    stripTitle: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, color: colors.textOnPrimary, marginTop: 2 },
    stripSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textOnPrimaryMuted, marginTop: 3 },
    saveFab: {
      position: 'absolute',
      top: spacing.sm + 4,
      right: spacing.sm + 4,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.soft,
    },
    saveFabOn: { backgroundColor: colors.primary },
    body: { padding: spacing.lg, paddingTop: spacing.sm },
    matchGroup: { marginTop: spacing.sm, gap: spacing.sm + 2 },
    matchRow: {},
    matchHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    matchLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    matchPercent: { fontFamily: fonts.serif, fontSize: 22, color: colors.textPrimary },
    matchTrack: { height: 4, borderRadius: 2, backgroundColor: colors.blush, marginTop: 6, overflow: 'hidden' },
    matchFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
    matchDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    sectionHeading: {
      fontFamily: fonts.sansBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: spacing.xs + 2,
    },
    quoteWrap: { marginTop: spacing.md },
    quote: {
      flexDirection: 'row',
      backgroundColor: colors.blush,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm + 2,
    },
    quoteBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary, alignSelf: 'stretch' },
    quoteText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.textPrimary },
    itemList: { marginTop: spacing.md, gap: spacing.xs },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm + 4,
      paddingVertical: spacing.xs + 2,
    },
    itemText: { flex: 1 },
    itemName: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.textPrimary },
    itemSub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actions: { marginTop: spacing.md, gap: spacing.sm },
  });
