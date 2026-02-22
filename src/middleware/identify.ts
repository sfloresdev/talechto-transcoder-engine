import { verifyToken } from '../services/authService';
import { getOrCreateUser } from "../services/userService";

export async function identifyRequester(req: Request, clientIp: string): Promise<string> {
    const cookieHeader = req.headers.get("Cookie");

    if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        const token = cookies["auth_token"];

        if (token) {
            const userPayload = await verifyToken(token);
            if (userPayload) {
                console.log("[Auth] User identified via Token");
                return userPayload.id;
            }
        }
    }
    return await getOrCreateUser(clientIp);
}

export async function getAuthenticatedUser(req: Request): Promise<string | null> {
    const cookieHeader = req.headers.get("Cookie");
    if (!cookieHeader) return null;
    
    const cookies = parseCookies(cookieHeader);
    const token = cookies["auth_token"];
    if (!token) return null;

    const userPayload = await verifyToken(token);
    return userPayload ? userPayload.id : null;
}


function parseCookies(cookieHeader: string): Record<string, string> {
    const list: Record<string, string> = {};
    cookieHeader.split(`;`).forEach((cookie) => {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });
    return list;
}