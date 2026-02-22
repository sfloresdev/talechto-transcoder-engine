import { SignJWT, jwtVerify } from "jose";

const {
    JWT_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
} = process.env;

if (!JWT_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Critical enviroment variables for Auth are missing");
}

const ENCODED_SECRET = new TextEncoder().encode(JWT_SECRET);

export interface UserPayload {
    id: string; // Google ID
    email: string;
}

// JWT signed for the user
export async function createToken(user: UserPayload): Promise<String> {
    return await new SignJWT({ ...user })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("15d")
        .sign(ENCODED_SECRET);
}

// Validates a JWT recieved in a request
export async function verifyToken(token: string): Promise<UserPayload | null> {
    try {
        const { payload } = await jwtVerify(token, ENCODED_SECRET);
        return payload as unknown as UserPayload;
    } catch (error) {
        return null;
    }
}

// Checks Google user for auth
export async function getGoogleUser(code: string): Promise<UserPayload> {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            redirect_uri: GOOGLE_REDIRECT_URI!,
            grant_type: "authorization_code",
        }).toString(),
    });

    if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Google token Exchange Failed: ${error}`);
    }

    const tokens = await tokenResponse.json() as { access_token: string };

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok)
        throw new Error("Failed to fetch user info from Google");

    const googleProfile = await userResponse.json() as any;

    return {
        id: String(googleProfile.id),
        email: googleProfile.email
    };
}

