import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCertificatePdf } from '../src/certificate-renderer.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const output = join(ROOT, 'output', 'pdf');
await mkdir(output, { recursive: true });

await Promise.all([
  writeFile(join(output, 'elitea-certifikat-vzor.pdf'), await renderCertificatePdf({
    memberName: 'Anna Nováková',
    courseTitle: 'Komunikace, která funguje',
    completedAt: '2026-08-30T10:00:00.000Z',
    variant: 'light',
  })),
  writeFile(join(output, 'elitea-osvedceni-vzor.pdf'), await renderCertificatePdf({
    memberName: 'Soňa Dobyšarová',
    courseTitle: 'Pevná v sobě',
    completedAt: '2026-08-30T10:00:00.000Z',
    variant: 'dark',
  })),
]);
