import { getGoogleUser, createToken } from "../services/authService";
import { syncUserWithGoogle } from "../services/userService";

export async function handleAuthCallback(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return new Response(JSON.stringify({ error: "No code provided" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // This gives the id and email verified by google
        const googleUser = await getGoogleUser(code);
        // Saves the user if it is new or retrieves data if already existed
        const user = syncUserWithGoogle(googleUser.id, googleUser.email);
        // Generate the JWT signed by us
        const token = await createToken({ id: user.id, email: user.email });

        const responseBody = JSON.stringify({
            success: true,
            user: {
                email: user.email,
                isPremium: !!user.is_premium
            }
        });

        const MAX_AGE = 15 * 24 * 60 * 60;

        return new Response(responseBody, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": `auth_token=${token}; HttpOnly; Path=/; Max-age=${MAX_AGE}; SameSite=Lax`
            }
        });
    } catch (error: any) {
        console.error("[Auth Route Error] ", error);
        return new Response(JSON.stringify({ error: "Authentication failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
