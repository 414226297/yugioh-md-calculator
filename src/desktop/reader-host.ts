import { fork, type ChildProcess } from 'node:child_process';

/** Owns one disposable reader. Never shares native objects with the renderer. */
export class ReaderHost {
  child: ChildProcess | null = null;
  generation = 0;
  constructor(private entry: string, private receive: (value: unknown) => void,
    private failed: (reason: string) => void, private executable = process.execPath) {}
  start(env: Record<string, string> = {}) {
    this.stop();
    const generation = ++this.generation;
    const child = fork(this.entry, [], {
      execPath: this.executable,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...env },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true
    });
    this.child = child;
    child.on('message', value => { if (generation === this.generation) this.receive(value); });
    child.on('error', error => { if (generation === this.generation) this.failed(error.message); });
    child.on('exit', (code, signal) => {
      if (generation === this.generation) {
        this.child = null;
        this.failed(`读取进程退出 (${code ?? signal})，请重新连接`);
      }
    });
  }
  stop() { ++this.generation; this.child?.kill(); this.child = null; }
}
