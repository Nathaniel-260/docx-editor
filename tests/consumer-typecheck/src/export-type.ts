/**
 * Consumer typecheck: the browser editor exports exactly one DOCX format.
 */
import type { ExportParams, ExportType } from 'superdoc';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertEqual<A, B> = Equal<A, B> extends true ? true : never;

const _exportTypeIsDocx: AssertEqual<ExportType, 'docx'> = true;
const _exportTypeParamIsExact: AssertEqual<ExportParams['exportType'], readonly ['docx'] | undefined> = true;

const _docx: ExportParams = { exportType: ['docx'] };

// @ts-expect-error PDF output is not supported by the browser editor.
const _pdf: ExportParams = { exportType: ['pdf'] };
// @ts-expect-error HTML output is not supported by the browser editor.
const _html: ExportParams = { exportType: ['html'] };
// @ts-expect-error The export format list cannot be empty.
const _empty: ExportParams = { exportType: [] };
// @ts-expect-error The browser editor accepts one DOCX output format.
const _multiple: ExportParams = { exportType: ['docx', 'docx'] };

void [_exportTypeIsDocx, _exportTypeParamIsExact, _docx, _pdf, _html, _empty, _multiple];
