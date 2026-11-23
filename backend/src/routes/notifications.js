import { Router } from 'express';
import { z } from 'zod';
import { getPool } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const uuid = z.string().uuid();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const pool = getPool();
    const [[notifications], [counts]] = await Promise.all([
      pool.execute(`SELECT id,type,title,body,target_id AS targetId,read_at AS readAt,created_at AS createdAt
        FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100`, [req.user.sub]),
      pool.execute('SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id=? AND read_at IS NULL', [req.user.sub]),
    ]);
    res.json({ notifications, unreadCount: Number(counts[0]?.unreadCount || 0) });
  } catch (error) { next(error); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    const [result] = await getPool().execute('UPDATE notifications SET read_at=UTC_TIMESTAMP() WHERE user_id=? AND read_at IS NULL', [req.user.sub]);
    res.json({ markedRead: result.affectedRows });
  } catch (error) { next(error); }
});

router.patch('/:notificationId/read', async (req, res, next) => {
  const parsed = uuid.safeParse(req.params.notificationId);
  if (!parsed.success) return res.status(400).json({ message: 'Identificador de notificação inválido.' });
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT id FROM notifications WHERE id=? AND user_id=? LIMIT 1', [parsed.data, req.user.sub]);
    if (!rows.length) return res.status(404).json({ message: 'Notificação não encontrada.' });
    await pool.execute('UPDATE notifications SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE id=? AND user_id=?', [parsed.data, req.user.sub]);
    res.json({ read: true });
  } catch (error) { next(error); }
});

export default router;
