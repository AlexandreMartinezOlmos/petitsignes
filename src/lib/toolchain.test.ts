import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the repository declares about the machinery that builds it.
 *
 * None of this breaks a build when it drifts, which is exactly why it is written
 * down as tests: a workflow that runs an action by a movable tag, or a Node
 * range nothing ever runs, looks the same as a correct one until the day it
 * matters.
 */

const WORKFLOWS_DIR = '.github/workflows';

const workflows = readdirSync(WORKFLOWS_DIR)
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(WORKFLOWS_DIR, name), 'utf8') }));

describe('the CI workflows', () => {
  it('exist, so the checks below are not passing over nothing', () => {
    expect(workflows.length).toBeGreaterThan(0);
  });

  /**
   * A tag like `@v5` is a pointer the action's owner can move to other code
   * after this repository reviewed it; a commit cannot be moved. The trailing
   * comment is what Dependabot reads and rewrites, and what a reviewer reads to
   * know which version the commit is.
   */
  it('run every action from a commit, named by its version', () => {
    for (const { name, text } of workflows) {
      for (const match of text.matchAll(/^\s*(?:-\s*)?uses:\s*(.+)$/gm)) {
        const use = match[1]!.trim();
        // A local action (`./…`) is code in this repository, reviewed with it.
        if (use.startsWith('./')) continue;
        expect(use, `${name}: ${use}`).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d[\w.-]*$/);
      }
    }
  });

  // Without it the job token gets the repository's default, which can include
  // writing to the repository — far more than a run that only reads code needs.
  it('declare the token’s permissions instead of inheriting the default', () => {
    for (const { name, text } of workflows) {
      expect(text, name).toMatch(/^permissions:/m);
    }
  });
});

describe('the Node version', () => {
  /**
   * `.nvmrc` is the version CI installs and every contributor is pointed at;
   * `engines` is what the package tells npm it supports. They used to disagree
   * — `>=22.12.0` against 24 — which advertised a Node 22 that nothing ever
   * built or tested on.
   */
  it('starts the supported range at the version CI runs', () => {
    const nvmrc = readFileSync('.nvmrc', 'utf8').trim().replace(/^v/, '');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      engines: { node: string };
    };

    const nvmrcMajor = nvmrc.split('.')[0];
    const enginesMajor = /^>=\s*(\d+)/.exec(pkg.engines.node)?.[1];

    expect(enginesMajor, `engines.node is "${pkg.engines.node}"`).toBe(nvmrcMajor);
  });
});
