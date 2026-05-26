// Minimal ambient declaration of the browser `ImageData` global so the
// jSquash codec types (which reference it in their .d.ts files) resolve
// under our tsconfig.base.json (no DOM lib). At runtime we never
// construct an actual ImageData — we pass duck-typed plain objects with
// the same { data, width, height } shape; jSquash reads those three
// fields only.
//
// Refs: D-RA-16 (compose stack scaffolding)

declare interface ImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: string;
}
