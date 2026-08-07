/**
 * @format
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {
  ThemeTokens,
  applyPalette,
  colors as activeColors,
  currentPaletteMeta,
  loadSavedTheme,
  palettes,
  saveTheme,
  shadow,
  subscribeToThemeChanges,
} from '../src/theme';
import useThemedStyles from '../src/hooks/useThemedStyles';

const terracotta = palettes.find((p) => p.key === 'terracotta')!;
const midnight = palettes.find((p) => p.key === 'midnight')!;

const makeStyles = ({ colors }: ThemeTokens) =>
  StyleSheet.create({
    box: { backgroundColor: colors.background },
  });

function Probe() {
  const styles = useThemedStyles(makeStyles);
  return <View testID="box" style={styles.box} />;
}

function backgroundOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const box = tree.root.findByProps({ testID: 'box' });
  return StyleSheet.flatten(box.props.style).backgroundColor;
}

afterEach(() => {
  applyPalette('terracotta');
});

describe('runtime palette switching', () => {
  it('restyles a mounted component when the palette changes', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<Probe />);
    });

    expect(backgroundOf(tree)).toBe(terracotta.colors.background);

    // The component stays mounted across the switch — this is the whole point
    // of M1-T3, and what the old module-scope StyleSheet.create could not do.
    await ReactTestRenderer.act(() => {
      applyPalette('midnight');
    });

    expect(backgroundOf(tree)).toBe(midnight.colors.background);
    expect(midnight.colors.background).not.toBe(terracotta.colors.background);

    // Unmount before afterEach resets the palette, so the reset does not push a
    // store update into a still-mounted tree outside act().
    await ReactTestRenderer.act(() => {
      tree.unmount();
    });
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToThemeChanges(listener);

    applyPalette('ocean');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    applyPalette('midnight');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // M1-T4: the picker calls saveTheme; these are its two other criteria.
  it('persists the selection and restores it on the next launch', async () => {
    const ocean = palettes.find((p) => p.key === 'ocean')!;

    await saveTheme('ocean');
    expect(currentPaletteMeta.key).toBe('ocean');

    // Cold start: in-memory palette is back at the default, storage is not.
    applyPalette('terracotta');
    expect(await loadSavedTheme()).toBe('ocean');
    expect(activeColors.background).toBe(ocean.colors.background);

    await saveTheme('terracotta');
  });

  it('moves shadow colour with the palette', () => {
    applyPalette('midnight');
    expect(shadow.soft.shadowColor).toBe(midnight.shadowColor);

    applyPalette('terracotta');
    expect(shadow.soft.shadowColor).toBe(terracotta.shadowColor);
  });
});
