#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const defaultRedirectsPath = resolve(scriptDirectory, '../out/_redirects');
const v1SectionMarker = '# V1 route dispositions';
const defaultConcurrency = 12;
const defaultRequestTimeoutMs = 25_000;

export function parseCurrentRedirectRules(contents) {
  const rules = [];
  let reachedV1Section = false;

  for (const [index, rawLine] of contents.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line.startsWith(v1SectionMarker)) {
      reachedV1Section = true;
      break;
    }
    if (!line || line.startsWith('#')) continue;

    const fields = line.split(/\s+/u);
    if (fields.length !== 3) {
      throw new Error(`Invalid redirect rule on line ${index + 1}: ${line}`);
    }

    const [source, destination, statusText] = fields;
    const status = Number(statusText);
    if (!source.startsWith('/') || !destination.startsWith('/')) {
      throw new Error(`Redirect on line ${index + 1} must use paths on this deployment: ${line}`);
    }
    if (status !== 301 && status !== 302) {
      throw new Error(`Redirect status must be 301 or 302 on line ${index + 1}: ${line}`);
    }

    rules.push({ source, destination, status });
  }

  if (!reachedV1Section) {
    throw new Error(`Missing "${v1SectionMarker}" marker; cannot separate current redirects from V1 redirects.`);
  }

  return rules;
}

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The status, location, and final URL are the contract. A body that already
    // closed does not change that result.
  }
}

async function probeRedirect(rule, { origin, fetchImpl, requestTimeoutMs }) {
  const requested = new URL(rule.source, origin);
  const expected = new URL(rule.destination, origin);
  let response;

  try {
    response = await fetchImpl(requested, {
      redirect: 'manual',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    return { ...rule, failure: `request failed: ${error.message}` };
  }

  const location = response.headers.get('location');
  const receivedStatus = response.status;
  await cancelBody(response);

  if (receivedStatus !== rule.status) {
    return { ...rule, failure: `got status ${receivedStatus}` };
  }
  if (!location) {
    return { ...rule, failure: 'response has no Location header' };
  }

  const receivedDestination = new URL(location, requested);
  if (receivedDestination.href !== expected.href) {
    return { ...rule, failure: `got Location ${receivedDestination.href}` };
  }

  try {
    response = await fetchImpl(requested, {
      redirect: 'follow',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    return { ...rule, failure: `redirect failed: ${error.message}` };
  }

  const finalStatus = response.status;
  const finalUrl = response.url;
  await cancelBody(response);

  if (finalStatus !== 200) {
    return { ...rule, failure: `destination returned ${finalStatus} at ${finalUrl}` };
  }
  if (finalUrl !== expected.href) {
    return { ...rule, failure: `finished at ${finalUrl}` };
  }

  return { ...rule };
}

export async function probeCurrentRedirects(
  rules,
  {
    origin,
    fetchImpl = fetch,
    concurrency = defaultConcurrency,
    requestTimeoutMs = defaultRequestTimeoutMs,
  },
) {
  const normalizedOrigin = new URL(origin).origin;
  const results = [];

  for (let index = 0; index < rules.length; index += concurrency) {
    const batch = rules.slice(index, index + concurrency);
    results.push(
      ...(await Promise.all(
        batch.map((rule) => probeRedirect(rule, { origin: normalizedOrigin, fetchImpl, requestTimeoutMs })),
      )),
    );
  }

  return results;
}

async function main() {
  const origin = new URL(process.argv[2] ?? 'https://superdoc-docs-next.pages.dev').origin;
  const redirectsPath = resolve(process.argv[3] ?? defaultRedirectsPath);
  const rules = parseCurrentRedirectRules(await readFile(redirectsPath, 'utf8'));

  process.stdout.write(`Probing ${rules.length} redirects from ${redirectsPath} against ${origin}\n`);
  const results = await probeCurrentRedirects(rules, { origin });
  const failures = results.filter((result) => result.failure);

  for (const { source, destination, status, failure } of failures) {
    process.stdout.write(`  ${source}: expected ${status} -> ${destination}; ${failure}\n`);
  }

  process.stdout.write(`\n${results.length - failures.length}/${results.length} deployed redirects passed\n`);
  if (failures.length > 0) process.exitCode = 1;
}

const invokedScript = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedScript === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`Redirect verification failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
