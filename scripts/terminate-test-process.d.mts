import type { ChildProcess } from 'node:child_process';

export function terminateTestProcess(child: ChildProcess | undefined): void;
