// Assertions involving clipboard/transcript text must never attach the values
// to AssertionError metadata, stderr, or a failure report.
export function assertPrivateText(actual, expected) {
  if (actual !== expected) throw new Error('Private text comparison failed; contents withheld.');
}
