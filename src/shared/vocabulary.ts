import type { Settings } from './contracts';

// Original, opt-in recognition hints. No application context is inspected.
export const codingVocabulary = [
  'API',
  'JSON',
  'TypeScript',
  'JavaScript',
  'Python',
  'React',
  'Node.js',
  'GitHub',
  'Git',
  'SQL',
  'PostgreSQL',
  'Docker',
  'Kubernetes',
  'GraphQL',
  'WebSocket',
  'OAuth',
  'UTF-8',
  'CI/CD',
  'pull request',
  'repository',
  'async',
  'await',
  'callback',
  'middleware',
  'localhost',
  'endpoint',
  'frontend',
  'backend',
  'unit test',
  'integration test',
  'refactor',
  'deployment',
  'environment variable',
  'command line',
  'dependency',
  'stack trace',
  'cache',
  'database',
  'schema',
  'npm',
] as const;

export function providerVocabulary(
  settings: Pick<Settings, 'dictionary' | 'codingVocabulary'>,
): string[] {
  const seen = new Set<string>();
  // User terms take priority when the provider's 1,000-term limit is reached.
  return [...settings.dictionary, ...(settings.codingVocabulary ? codingVocabulary : [])]
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 1000);
}
