// The shared studio plates (src/assets/plates/<name>.jpg, 2048x1152). One is
// left: "feniex", a Feniex light bar in the same bright studio as the
// portraits, beside the internship in At Work. A missing plate means no photo.
import type { ImageMetadata } from 'astro';

const plates = import.meta.glob<{ default: ImageMetadata }>('../assets/plates/*.{jpg,jpeg,png,webp,avif}');

export async function loadPlate(name: string): Promise<ImageMetadata | undefined> {
  const key = Object.keys(plates).find((k) => k.split('/').pop()!.replace(/\.\w+$/, '') === name);
  return key ? (await plates[key]()).default : undefined;
}
