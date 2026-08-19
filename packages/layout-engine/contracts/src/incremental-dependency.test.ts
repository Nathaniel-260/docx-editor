import { describe, expect, it } from 'vitest';
import {
  isValidNonFlowingPageRelativeAnchorDependencyProof,
  isValidPageCheckpointDependencyCertificate,
  type PageCheckpointDependencyCertificate,
} from './incremental-dependency.js';

describe('incremental dependency certificates', () => {
  it('requires one fingerprint for every named dependency class', () => {
    const certificate: PageCheckpointDependencyCertificate = {
      version: 1,
      certificateId: 'checkpoint:12:paragraph-4',
      owner: {
        sourceRevision: 'source:7',
        renderInputEpoch: 3,
        fontEpoch: 'font:2',
        styleEpoch: 'style:5',
        packetFingerprint: 'packet:abc',
      },
      storyKey: 'main',
      partUri: '/word/document.xml',
      pageIndex: 12,
      blockId: 'paragraph-4',
      prefixFragmentCount: 2,
      dependencyClasses: ['checkpoint-geometry', 'source-topology'],
      classFingerprints: {
        'checkpoint-geometry': 'geometry:a',
        'source-topology': 'topology:b',
      },
      upstreamConvergenceFingerprint: 'upstream:a',
      downstreamConvergenceFingerprint: 'downstream:b',
      fragmentTopologyFingerprint: 'fragments:c',
    };

    expect(isValidPageCheckpointDependencyCertificate(certificate)).toBe(true);
    expect(
      isValidPageCheckpointDependencyCertificate({
        ...certificate,
        classFingerprints: { 'checkpoint-geometry': 'geometry:a' },
      }),
    ).toBe(false);
    expect(
      isValidPageCheckpointDependencyCertificate({
        ...certificate,
        owner: { ...certificate.owner, renderInputEpoch: 4 },
      }),
    ).toBe(true);
  });

  it('validates image and drawing anchor carriers and rejects duplicate identities', () => {
    const common = {
      carrierParagraphId: 'p1',
      sourcePageIndex: 4,
      sectionIndex: 0,
      geometryFingerprint: 'geometry',
      measureFingerprint: 'measure',
      pageGeometryFingerprint: 'page',
    };
    const proof = {
      version: 2,
      sourceLayoutEpoch: 9,
      inventoryFingerprint: 'inventory',
      entries: [
        { ...common, blockId: 'image-1', blockKind: 'image' },
        { ...common, blockId: 'drawing-1', blockKind: 'drawing', drawingKind: 'textboxShape' },
      ],
    };

    expect(isValidNonFlowingPageRelativeAnchorDependencyProof(proof)).toBe(true);
    expect(
      isValidNonFlowingPageRelativeAnchorDependencyProof({
        ...proof,
        entries: [proof.entries[0], { ...proof.entries[1], blockId: 'image-1' }],
      }),
    ).toBe(false);
    expect(
      isValidNonFlowingPageRelativeAnchorDependencyProof({
        ...proof,
        entries: [{ ...common, blockId: 'drawing-1', blockKind: 'drawing', drawingKind: 'unknown' }],
      }),
    ).toBe(false);
  });
});
