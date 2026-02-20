import { identifyRequester } from "../middleware/identify";
import { convertAudio } from "../services/ffmpeg";
import { createLog } from "../services/logService";
import { checkUserLimit, recordConversion } from "../services/userService";
import { join } from "path";

const TEMP_DIR = join(import.meta.dir, "../../temp");
const MAX_FREE_SIZE = 50 * 1024 * 1024; // 50MB

export async function handleConvertRoute(req: Request, ip: string): Promise<Response> {
    // Only accept POST request
    if (req.method !== "POST")
        return new Response("Method not allowed", { status: 405 })

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
        return new Response("Content-Type must be multipart/form-data", { status: 400 });
    }

    let userId = "unknown";

    try {
        userId = await identifyRequester(req, ip);

        // Check daily_usage of X user
        const { allowed, remaining } = checkUserLimit(userId);
        if (!allowed) {
            createLog(userId, 'LIMIT_REACHED', 'User tried to convert without credits');
            return new Response(JSON.stringify({ error: "Daily limit reached", }), { status: 429 })
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const format = formData.get("format") as string || "mp3";
        const isPremium = remaining >= 999;

        // Check if a file was provided
        if (!file) {
            return new Response(JSON.stringify({ error: "No file was provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Check MAX_FREE_SIZE if is NOT premium user 
        if (file.size > MAX_FREE_SIZE && !isPremium) {
            const sizeinMb = (file.size / (1024 * 1024)).toFixed(2);
            createLog(userId, 'SIZE_EXCEEDED', `Rejected: ${file.name} (${sizeinMb}MB)`)

            return new Response(JSON.stringify({
                error: "File too large",
                message: `The free limit is 50MB. Your file weights ${sizeinMb}MB.`
            }), { status: 413 });
        }

        // Log creation
        createLog(userId, 'CONVERSION_START', `${file.name} -> ${format}`);

        // Temporal name with "talechto" embedded
        const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const outputFilename = isPremium ?
            `${originalName}.${format}`
            : `talechto_${originalName}.${format}`;

        // Timestamp and "temp/" directory output
        const timestamp = Date.now();
        const inputPath = join(TEMP_DIR, `in_${timestamp}_${file.name}`);
        const outputPath = join(TEMP_DIR, `out_${timestamp}.${format}`);

        // Call out FFmpeg Service
        await Bun.write(inputPath, file);
        console.log(`[API] Converting ${file.name} to ${format}...`);
        await convertAudio(inputPath, outputPath, format);

        // Update daily usage for X user
        recordConversion(userId);
        createLog(userId, 'CONVERSION_SUCCESS', `${file.name} converted`)

        const buffer = await Bun.file(outputPath).arrayBuffer();

        // Cleaning
        Promise.all([
            Bun.file(inputPath).delete(),
            Bun.file(outputPath).delete()
        ]).catch(err => console.error("[Cleanup Error]", err));

        // Return file to the client
        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": `audio/${format}`,
                "Content-Disposition": `attachment; filename="${outputFilename}"`,
                "X-Remaining-Credits": remaining.toString()
            },
        });
    } catch (error: any) {
        if (userId !== "unknown")
            createLog(userId, 'CONVERSION_ERROR', error.message);
        console.error("[Route Error] ", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        })
    }
}