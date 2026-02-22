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

    // TEST 4: Attack GET method instead of POST
    test("Should reject GET requests with Mehtod not Allowed (405)", async () => {
        const req = new Request("http://localhost/api/convert", {
            method: 'GET'
        });

        const res = await handleConvertRoute(req, '127.0.0.1');

        expect(res.status).toBe(405);
        const text = await res.text();
        expect(text).toBe("Method not allowed");
    });

    // TEST 5: Attack GET Headers instead of files
    test("Should reject if Content-Type is not multipart/form-data (400)", async () => {
        // Un bot intenta enviar un JSON malicioso en lugar de un formulario con archivo
        const req = new Request("http://localhost/api/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file: "soy_un_virus.exe", format: "mp3" })
        });

        const res = await handleConvertRoute(req, "127.0.0.2");

        expect(res.status).toBe(400);
        const text = await res.text();
        expect(text).toBe("Content-Type must be multipart/form-data");
    });

    // TEST 6: Bad request (Form with NO "file" field)
    test("Should handle FormData with missing 'file' field gracefully (400)", async () => {
        const formData = new FormData();
        formData.append("format", "wav");
        formData.append("random_field", "hacked");
        // Se nos "olvida" adjuntar el archivo

        const req = new Request("http://localhost/api/convert", {
            method: "POST",
            body: formData
        });

        const res = await handleConvertRoute(req, "127.0.0.3");

        expect(res.status).toBe(400);
        const data = await res.json() as { error: string };
        expect(data.error).toBe("No file was provided");
    });


    // TEST 7: Format injection
    test("Should fallback to mp3 if format is empty", async () => {
        const dummyFile = new File(["audio"], "test.wav", { type: "audio/wav" });
        const formData = new FormData();
        formData.append("file", dummyFile);
        formData.append("format", ""); // Empty format on porpuse 

        const req = new Request("http://localhost/api/convert", {
            method: "POST",
            body: formData
        });

        const res = await handleConvertRoute(req, "127.0.0.4");

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("audio/mp3");
    });
});