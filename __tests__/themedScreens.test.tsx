/**
 * @format
 *
 * M1-T3b — every screen and shared component restyles when the palette changes.
 *
 * `__tests__/theme.test.tsx` proves the mechanism on a synthetic probe. This
 * file proves the real files were actually migrated onto it, and guards the
 * pattern from regressing: a module-scope `StyleSheet.create` that reads the
 * palette is a defect that is invisible until someone switches theme (D-008).
 */

// `tsconfig.json` limits `types` to jest, so node globals are pulled in here
// rather than project-wide — this is the only file that touches the filesystem.
/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { applyPalette, palettes } from '../src/theme';
import Button from '../src/components/Button';
import Card from '../src/components/Card';
import SectionHeader from '../src/components/SectionHeader';
import OtpScreen from '../src/app/onboarding/otp';

const terracotta = palettes.find((p) => p.key === 'terracotta')!;
const midnight = palettes.find((p) => p.key === 'midnight')!;

/** Every resolved style in the rendered tree, flattened. */
function flattenedStyles(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  const here = node.props?.style ? [StyleSheet.flatten(node.props.style)] : [];
  const children: any[] = Array.isArray(node.children) ? node.children : [];
  return here.concat(children.flatMap(flattenedStyles));
}

function usesColor(tree: ReactTestRenderer.ReactTestRenderer, prop: string, value: string) {
  return flattenedStyles(tree.toJSON()).some((s) => s && s[prop] === value);
}

async function renderAndSwitch(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(element);
  });
  const before = tree.toJSON();
  // Switched while mounted — a remount would hide the bug this guards against.
  await ReactTestRenderer.act(() => {
    applyPalette('midnight');
  });
  return { tree, before };
}

afterEach(async () => {
  await ReactTestRenderer.act(() => {
    applyPalette('terracotta');
  });
});

describe('migrated components restyle on palette change', () => {
  it('Card follows the palette surface', async () => {
    const { tree } = await renderAndSwitch(
      <Card>
        <View />
      </Card>,
    );

    expect(usesColor(tree, 'backgroundColor', midnight.colors.surface)).toBe(true);
    expect(usesColor(tree, 'backgroundColor', terracotta.colors.surface)).toBe(false);

    await ReactTestRenderer.act(() => tree.unmount());
  });

  it('Button follows the palette primary', async () => {
    const { tree } = await renderAndSwitch(<Button title="Go" onPress={() => {}} />);

    expect(usesColor(tree, 'backgroundColor', midnight.colors.primary)).toBe(true);
    expect(usesColor(tree, 'backgroundColor', terracotta.colors.primary)).toBe(false);

    await ReactTestRenderer.act(() => tree.unmount());
  });

  it('SectionHeader follows the palette text colour', async () => {
    const { tree } = await renderAndSwitch(<SectionHeader title="Today" subtitle="A" />);

    expect(usesColor(tree, 'color', midnight.colors.textPrimary)).toBe(true);
    expect(usesColor(tree, 'color', terracotta.colors.textPrimary)).toBe(false);

    await ReactTestRenderer.act(() => tree.unmount());
  });

  it('a migrated screen restyles without remounting', async () => {
    const nav = { goBack: () => {}, navigate: () => {} } as any;
    const { tree } = await renderAndSwitch(<OtpScreen navigation={nav} route={{} as any} />);

    expect(usesColor(tree, 'backgroundColor', midnight.colors.background)).toBe(true);
    expect(usesColor(tree, 'backgroundColor', terracotta.colors.background)).toBe(false);

    await ReactTestRenderer.act(() => tree.unmount());
  });
});

describe('no style block reads the palette at module scope', () => {
  const SRC = path.join(__dirname, '..', 'src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it.each(sourceFiles(SRC).map((f) => [path.relative(SRC, f), f]))(
    '%s builds styles in the render path',
    (_name, file) => {
      const source = fs.readFileSync(file as string, 'utf8');
      // A top-level `const styles = StyleSheet.create(` snapshots the palette at
      // module load; the factory form passed to useThemedStyles does not.
      expect(source).not.toMatch(/^const styles\s*(:[^=]+)?=\s*StyleSheet\.create\(/m);
    },
  );
});
