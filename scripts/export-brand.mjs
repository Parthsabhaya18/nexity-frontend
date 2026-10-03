import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rasterize } from './brand-raster.mjs';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(project, 'src', 'assets', 'brand', 'handoff');
const androidRes = join(project, 'android', 'app', 'src', 'main', 'res');
const xcassets = join(project, 'ios', 'Nexity', 'Images.xcassets');

const jobs = [
  { svg: 'app-icon/app-icon.svg', out: 'app-icon/app-icon-1024.png', width: 1024, opaque: true },
  { svg: 'app-icon/app-icon.svg', out: 'app-icon/play-store-512.png', width: 512, opaque: true },
  { svg: 'app-icon/app-icon-foreground.svg', out: 'app-icon/app-icon-foreground-432.png', width: 432 },
  { svg: 'app-icon/notification-icon.svg', out: 'app-icon/notification-icon-96.png', width: 96 },
  { svg: 'splash/splash-logo-light.svg', out: 'splash/splash-logo-light-1152.png', width: 1152 },
  { svg: 'splash/splash-logo-dark.svg', out: 'splash/splash-logo-dark-1152.png', width: 1152 },
  ...['', '-dark'].flatMap((tone) => [
    { svg: `home/logo-stacked${tone}.svg`, out: `home/logo-stacked${tone}.png`, width: 210, height: 183 },
    { svg: `home/logo-stacked${tone}.svg`, out: `home/logo-stacked${tone}@2x.png`, width: 420, height: 365 },
    { svg: `home/logo-stacked${tone}.svg`, out: `home/logo-stacked${tone}@3x.png`, width: 630, height: 548 },
  ]),
];

const read = (file) => readFileSync(join(root, file), 'utf8');

function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(file.substring(project.length + 1));
}

/** Wraps a square SVG master in a circular clip for legacy Android round launcher icons. */
function circular(svg) {
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)[1]);
  const inner = svg.replace(/<\?xml[^>]*\?>/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
    <defs><clipPath id="round"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></clipPath></defs>
    <g clip-path="url(#round)">${inner}</g></svg>`;
}

for (const job of jobs) {
  write(join(root, job.out), rasterize(read(job.svg), job));
}

const icon = read('app-icon/app-icon.svg');
const foreground = read('app-icon/app-icon-foreground.svg');
const notification = read('app-icon/notification-icon.svg');
const splash = { light: read('splash/splash-logo-light.svg'), dark: read('splash/splash-logo-dark.svg') };

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(densities)) {
  const mipmap = join(androidRes, `mipmap-${density}`);
  write(join(mipmap, 'ic_launcher.png'), rasterize(icon, { width: 48 * scale }));
  write(join(mipmap, 'ic_launcher_round.png'), rasterize(circular(icon), { width: 48 * scale }));
  write(join(mipmap, 'ic_launcher_foreground.png'), rasterize(foreground, { width: 108 * scale }));
  write(join(androidRes, `drawable-${density}`, 'ic_notification.png'), rasterize(notification, { width: 24 * scale }));
  write(join(androidRes, `drawable-${density}`, 'splash_logo.png'), rasterize(splash.light, { width: 288 * scale }));
  write(join(androidRes, `drawable-night-${density}`, 'splash_logo.png'), rasterize(splash.dark, { width: 288 * scale }));
}

const iosIcons = [
  { size: 20, scale: 2 },
  { size: 20, scale: 3 },
  { size: 29, scale: 2 },
  { size: 29, scale: 3 },
  { size: 40, scale: 2 },
  { size: 40, scale: 3 },
  { size: 60, scale: 2 },
  { size: 60, scale: 3 },
  { size: 1024, scale: 1, idiom: 'ios-marketing' },
];
const appIconSet = join(xcassets, 'AppIcon.appiconset');
for (const { size, scale } of iosIcons) {
  write(join(appIconSet, `icon-${size * scale}.png`), rasterize(icon, { width: size * scale, opaque: true }));
}
write(
  join(appIconSet, 'Contents.json'),
  JSON.stringify(
    {
      images: iosIcons.map(({ size, scale, idiom = 'iphone' }) => ({
        filename: `icon-${size * scale}.png`,
        idiom,
        scale: `${scale}x`,
        size: `${size}x${size}`,
      })),
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  ) + '\n',
);

const splashSet = join(xcassets, 'SplashLogo.imageset');
const splashImages = [];
for (const tone of ['light', 'dark']) {
  for (const scale of [2, 3]) {
    const filename = `splash-logo-${tone}@${scale}x.png`;
    write(join(splashSet, filename), rasterize(splash[tone], { width: 300 * scale }));
    splashImages.push({
      filename,
      idiom: 'universal',
      scale: `${scale}x`,
      ...(tone === 'dark' && { appearances: [{ appearance: 'luminosity', value: 'dark' }] }),
    });
  }
}
write(
  join(splashSet, 'Contents.json'),
  JSON.stringify({ images: splashImages, info: { author: 'xcode', version: 1 } }, null, 2) + '\n',
);

for (const tone of ['', '-dark']) {
  for (const suffix of ['', '@2x', '@3x']) {
    const name = `logo-stacked${tone}${suffix}.png`;
    copyFileSync(join(root, 'home', name), join(project, 'src', 'assets', 'brand', 'png', name));
    console.log(`src/assets/brand/png/${name}`);
  }
}
