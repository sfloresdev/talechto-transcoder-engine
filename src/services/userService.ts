import { db } from "../db/database";

const IP_SALT = process.env.IP_SALT || "test"

export async function getOrCreateUser(ip: string): Promise<string> {
    // Generate de Hash for the IP
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(ip + IP_SALT);
    const userId = hasher.digest("hex");

    db.run(
        `INSERT OR IGNORE INTO users (id) VALUES ($id)`,
        { $id: userId } as any
    );
    return userId;
}

export function checkUserLimit(userId: string): { allowed: boolean; remaining: number } {
    // Check if premium
    const user = db.query(`SELECT is_premium FROM users WHERE id = $id`)
        .get({ $id: userId }) as { is_premium: number } | null;

    if (user?.is_premium === 1) {
        return { allowed: true, remaining: 999 };
    }

    // Today date
    const today = new Date().toISOString().slice(0, 10);

    // Check daily usage
    const usage = db.query(`
        SELECT count FROM daily_usage 
        WHERE user_id = $userId AND day = $day
    `).get({
        $userId: userId,
        $day: today
    }) as { count: number } | null;

    const count = usage?.count || 0;
    const limit = 5;

    return {
        allowed: count < limit,
        remaining: Math.max(0, limit - count)
    };
}

export function recordConversion(userId: string) {
    const today = new Date().toISOString().slice(0, 10);

    db.query(`
        INSERT INTO daily_usage (user_id, day, count) 
        VALUES ($userId, $day, 1)
        ON CONFLICT(user_id, day) 
        DO UPDATE SET count = count + 1
    `).run({
        $userId: userId,
        $day: today
    });

    console.log(`Uso incrementado para el usuario ${userId.substring(0, 8)}...`)
}