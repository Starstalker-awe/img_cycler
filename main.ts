import { v4 as uuid } from "uuid";
import * as fs from "node:fs";
import Elysia from "elysia";
import sharp from "sharp";

// +--------------+
// | Rate limiter |
// +--------------+
class RateLimiter {
    private state: {[ip: string]: number} = {};
    // Numbers here are derived straight from my ass
    static MAX_REQUESTS: number = 20;
    static TIMEFRAME = 10;

    constructor() { setInterval(() => this.state = {}, RateLimiter.TIMEFRAME * 1000)};

    public accepted(ip: string | undefined = "") {
        this.state[ip] ??= 0;
        return ++this.state[ip] < RateLimiter.MAX_REQUESTS;
    };
};

const rateLimiter = (app: Elysia) => app
.decorate("RateLimiter", new RateLimiter())
.onRequest(({ RateLimiter, set, request }) => { if (!RateLimiter.accepted(app.server!.requestIP(request)!.address)) { return set.status = 429 }});

// +-----------------------------+
// | Convert unoptimized -> webp |
// +-----------------------------+
const unoptimized = [...new Bun.Glob("*.{jpg,jpeg,png}").scanSync(`${import.meta.dir}/imgs`)];

if (unoptimized.length > 0) {
    for (const file of unoptimized) {
        await sharp(await Bun.file(`${import.meta.dir}/imgs/${file}`).bytes()).webp({
            effort: 6
        }).toFile(`${import.meta.dir}/imgs/${uuid().slice(0, 8)}.webp`);
        fs.unlinkSync(`${import.meta.dir}/imgs/${file}`);
    };
};

const images = [...new Bun.Glob("*.webp").scanSync(`${import.meta.dir}/imgs`)];

const gen = (function* getRandom() { while (true) { yield images[~~(Math.random() * images.length)]}})();

// +------------+
// | Web server |
// +------------+
const server = new Elysia()
.use(rateLimiter)
.get("/", async () => {
    return new Response(Bun.file(`${import.meta.dir}/imgs/${gen.next().value}`), { headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store"
    }});
})
.listen(5001);

// +-------------------------+
// | Re-launch on new images |
// +-------------------------+
fs.watch(`${import.meta.dir}/imgs/`, () => {
    Bun.spawn({
        cmd: `bun run ${import.meta.dir}/main.ts`.split(" "),
        stdout: "inherit"
    }).unref();
    process.exit(0);
});