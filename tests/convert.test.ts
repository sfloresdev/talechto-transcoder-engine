import { expect, test, describe, beforeAll } from "bun:test";
import { handleConvertRoute } from "../src/routes/convert";
import { initDB, db } from "../src/db/database";

describe("Talechto Engine Unit Testing", () => {

    beforeAll(() => {
        initDB();
        db.run("DELETE FROM daily_usage");
        db.run("DELETE FROM activity_logs");
    });

    // TEST 1: Test API rejects request without a file attached
    test("Should fail (400) if file is missing send", async () => {
        const req = new Request("http://localhost/api/convert", {
            method: "POST",
            body: new FormData() // Empty body 
        });

        const res = await handleConvertRoute(req, "127.0.0.1");
        expect(res.status).toBe(400);

        const data: any = await res.json();
        expect(data.error).toBe("No file was provided");
    });

    // TEST 2: Simulate daily limit of 5 requests
    // Here we send 6 request with the same IP
    test("Should block user after 5 requests (429)", async () => {
        const testIP = "192.168.1.50";
        const dummyFile = new File(["fake-audio-test"], "test.wav", { type: "audio/wav" });

        const sendRequest = async () => {
            const formData = new FormData();
            formData.append("file", dummyFile);
            formData.append("format", "mp3");

            const req = new Request("http://localhost/api/convert", {
                method: "POST",
                body: formData
            })
            return handleConvertRoute(req, testIP);
        }

        for (let i = 0; i < 5; i++) {
            const res = await sendRequest();
            expect(res.status).toBe(200);
        }

        const finalRes = await sendRequest();
        expect(finalRes.status).toBe(429);

        const data = await finalRes.json() as { error: string };
        expect(data.error).toBe("Daily limit reached");
    });

    // TEST 3: Verify file size MAX = 50MB (413)
    test("Should reject files larger than 50MB", async () => {
        const bigFile = new File([new Uint8Array(51 * 1024 * 1024)], "heavy.wav");

        const formData = new FormData();
        formData.append("file", bigFile);

        const req = new Request("http://localhost/api/convert", {
            method: 'POST',
            body: formData
        })

        const res = await handleConvertRoute(req, "1.1.1.1");
        expect(res.status).toBe(413) // Paylod too large
    });
});