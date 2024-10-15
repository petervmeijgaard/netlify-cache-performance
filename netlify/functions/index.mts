import { handle } from "hono/netlify";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { getStore } from "@netlify/blobs";
import { Redis } from "@upstash/redis";
import { Config } from "@netlify/functions";

const app = new Hono();
const redis = Redis.fromEnv();

const getDefaultStore = () => getStore({
	name: "default",
	consistency: "strong",
});

app.use(logger());

app.get("/reset", async (c) => {
	const store = getDefaultStore();

	await store.setJSON("counter", 0);
	await redis.set("counter", 0);

	return c.html(`<h1>Reset counter</h1>`);
});

type Params = {
	count: number;
	provider: string;
	readDuration: number;
	writeDuration: number;
	totalDuration: number;
}

const renderHtml = ({ provider, count, readDuration, writeDuration, totalDuration }: Params) => {
	return `
		<h1>Counter from ${provider} [${count}]</h1>
		<dl>
			<dt>Read duration</dt>
			<dd>${readDuration}ms</dd>
			<dt>Write duration</dt>
			<dd>${writeDuration}ms</dd>
			<dt>Total duration</dt>
			<dd>${totalDuration}ms</dd>
		</dl>
	`;
};

app.get("/upstash", async (c) => {
	const start = Date.now();

	const count = await redis.get<number>("counter");

	const readDuration = Date.now() - start;

	const startWrite = Date.now();

	await redis.set("counter", count + 1);

	const end = Date.now();

	const writeDuration = end - startWrite;
	const totalDuration = end - start;

	console.log(`Upstash took ${totalDuration}ms`);

	const html = renderHtml({
		count: count ?? 0,
		provider: "Upstash",
		readDuration,
		writeDuration,
		totalDuration,
	});

	return c.html(html);
});

app.get("/netlify-blobs", async (c) => {
	const store = getDefaultStore();

	const start = Date.now();

	const count = (await store.get("counter", { type: "json" })) as number;

	const readDuration = Date.now() - start;

	const startWrite = Date.now();

	await store.setJSON("counter", count + 1);

	const end = Date.now();

	const writeDuration = end - startWrite;
	const totalDuration = end - start;

	console.log(`Netlify Blobs took ${totalDuration}ms`);

	const html = renderHtml({
		count: count ?? 0,
		provider: "Netlify blobs",
		readDuration,
		writeDuration,
		totalDuration,
	});

	return c.html(html);
});

export default handle(app);

export const config: Config = {
	path: ["/*"],
};
