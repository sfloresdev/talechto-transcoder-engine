import { db } from "../db/database";

export type LogAction = 'CONVERSION_START' | 'CONVERSION_SUCCESS' | 'CONVERSION_ERROR' | 'LIMIT_REACHED' | 'SIZE_EXCEEDED';

export function createLog(userId: string, action: LogAction, details: string) {
    try {
        const query = db.query(`
            INSERT INTO activity_logs (user_id, action, details)
            VALUES ($userId, $action, $details)
        `);

        query.run({
            $userId: userId,
            $action: action,
            $details: details
        });
    } catch (error) {
        console.error("\x1b[91m✖Fallo crítico al escribir log en DB:\x1b[0m", error);
    }
}
