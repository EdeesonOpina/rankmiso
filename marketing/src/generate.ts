import { capture } from "./capture.ts";
import { compose } from "./compose.ts";
import { validate, writePreview } from "./validate.ts";

await capture();
await compose();
await writePreview();
const code = await validate();
process.exit(code);
