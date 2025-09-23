// Simple in-memory job queue with retry and exponential backoff.
// This is process-local and non-durable, suitable for small deployments and tasks that can be retried later.

type JobFn = () => Promise<void>;

type Job = {
	id: string;
	run: JobFn;
	tries: number;
	maxRetries: number;
	nextAt: number; // epoch ms
	baseDelayMs: number; // for backoff
};

const queue: Job[] = [];
let ticking = false;

function now() {
	return Date.now();
}

function scheduleTick() {
	if (ticking) return;
	ticking = true;
	setTimeout(tick, 200);
}

async function tick() {
	try {
		const t = now();
		// Pull jobs that are due
		const due: Job[] = [];
		for (let i = queue.length - 1; i >= 0; i--) {
			if (queue[i].nextAt <= t) {
				due.push(queue.splice(i, 1)[0]);
			}
		}
		for (const job of due) {
			try {
				await job.run();
			} catch (e) {
				job.tries += 1;
				if (job.tries <= job.maxRetries) {
					const delay = job.baseDelayMs * Math.pow(2, job.tries - 1);
					job.nextAt = now() + delay;
					queue.push(job);
					// eslint-disable-next-line no-console
					console.warn(`[queue] job ${job.id} failed (try ${job.tries}/${job.maxRetries}), retrying in ${delay}ms:`, (e as any)?.message || e);
				} else {
					// eslint-disable-next-line no-console
					console.error(`[queue] job ${job.id} failed permanently after ${job.tries} tries:`, (e as any)?.message || e);
				}
			}
		}
	} finally {
		ticking = false;
		if (queue.length) scheduleTick();
	}
}

export function enqueue(opts: {
	id?: string;
	run: JobFn;
	maxRetries?: number; // default 5
	baseDelayMs?: number; // default 1000
	startAfterMs?: number; // default 0
	onSuccess?: () => void;
}) {
	const job: Job = {
		id: opts.id || Math.random().toString(36).slice(2),
		run: opts.run,
		tries: 0,
		maxRetries: opts.maxRetries ?? 5,
		nextAt: now() + (opts.startAfterMs ?? 0),
		baseDelayMs: opts.baseDelayMs ?? 1000,
	};
	queue.push(job);
	scheduleTick();
	return job.id;
}

export function pendingJobsCount() {
	return queue.length;
}
