import { register } from "node:module";

// Test-only hooks for modules Node cannot load the way Next bundles them:
// - stylesheets: tests only need CSS module class names to exist, so each key maps to itself;
// - next/image: its CJS entry lacks next/link's default-export interop, so ESM sees an object, not a component.
register(`data:text/javascript,${encodeURIComponent(`export async function load(url, context, next) {
  if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, key) => String(key) });" };
  if (/[\\\\/]next[\\\\/]image\\.js$/.test(url)) return { format: "module", shortCircuit: true, source: "import { createRequire } from 'node:module'; const image = createRequire(import.meta.url)('./dist/shared/lib/image-external.js'); export default image.default; export const getImageProps = image.getImageProps;" };
  return next(url, context);
}`)}`);
