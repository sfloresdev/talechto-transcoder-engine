import { $ } from "bun";

export async function convertAudio(
    inputPath: string,
    outputPath: string,
    targetFormat: string
): Promise<void>{
    const allowedFormats = ["mp3", "wav", "flac", "m4a", "ogg"];

    if (!allowedFormats.includes(targetFormat))
        throw new Error(`Format not supported ${targetFormat}`);

    // Modern way of executing clean terminal commands
    try {
        await $`ffmpeg -y -i ${inputPath} ${outputPath}`.quiet();
    } catch (error) {
        console.error(`[FFmpeg ERROR] Failed to convert to ${targetFormat}`)
        throw new Error(`Internal error trying to convert the audio`);
    }
}
