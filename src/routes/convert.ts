import { convertAudio } from "../services/ffmpeg";

export async function handleConvertRoute(req: Request): Promise<Response> {
    // Only accept POST request
    if (req.method !== "POST")
        return new Response("Method not allowed", { status: 405 })

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const format = formData.get("format") as string || "mp3";

        const isPremium = formData.get("isPremium") === "true";

        if (!file) {
            return new Response(JSON.stringify({ error: "No file was provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Temporal name with "talechto" embedded
        const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        const outputFilename = isPremium ?
            `${originalName}.${format}`
            : `talechto_${originalName}.${format}`;

        const timestamp = Date.now();
        const inputPath = `./temp/in_${timestamp}_${file.name}`
        const outputPath = `./temp/out_${timestamp}.${format}`;

        await Bun.write(inputPath, file);

        // Call out FFmpeg Service
        console.log(`[API] Converting ${file.name} to ${format}...`);
        await convertAudio(inputPath, outputPath, format);

        const convertedFile = Bun.file(outputPath);
        const buffer = await convertedFile.arrayBuffer();

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
            },
        });
    } catch (error: any) {
        console.error("[Route Error] ", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        })
    }
}