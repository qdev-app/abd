/**
 * Generates the shadcn-installable registry JSON files under public/r/ from the
 * source manifest (registry.json) by inlining each referenced file's contents.
 *
 * Run: bun scripts/build-registry.ts  (or: pnpm --filter @abd/web registry)
 *
 * Consumers then install with:
 *   npx shadcn@latest add https://<your-host>/r/browser-detector.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'registry.json'), 'utf8')) as {
  items: RegistryItem[];
};

interface RegistryFile {
  path: string;
  type: string;
  target?: string;
}
interface RegistryItem {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
}

const outDir = resolve(root, 'public/r');
mkdirSync(outDir, { recursive: true });

const index: { name: string; type: string; title: string; description: string }[] = [];

for (const item of manifest.items) {
  const built = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies ?? [],
    registryDependencies: item.registryDependencies ?? [],
    files: item.files.map((f) => ({
      path: f.target ?? f.path,
      type: f.type,
      content: readFileSync(resolve(root, f.path), 'utf8'),
    })),
  };
  writeFileSync(resolve(outDir, `${item.name}.json`), JSON.stringify(built, null, 2) + '\n');
  index.push({ name: item.name, type: item.type, title: item.title, description: item.description });
  console.log(`✓ built public/r/${item.name}.json`);
}

writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ items: index }, null, 2) + '\n');
console.log(`✓ built public/r/index.json (${index.length} item${index.length === 1 ? '' : 's'})`);
