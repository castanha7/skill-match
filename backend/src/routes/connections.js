import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getPool } from '../services/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const uuid = z.string().uuid();
const createSchema = z.object({
  companyId: uuid.optional(),
  candidateUserId: uuid.optional(),
  message: z.string().trim().min(10).max(1200),
});
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });
const actionSchema = z.object({ action: z.enum(['accept', 'decline', 'block']) });
const connectionCreateRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
const messageRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });

async function addNotification(connection, userId, type, title, body, targetId) {
  await connection.execute(
    'INSERT INTO notifications (id,user_id,type,title,body,target_id) VALUES (?,?,?,?,?,?)',
    [randomUUID(), userId, type, title, body.slice(0, 500), targetId],
  );
}

async function findParticipantConnection(db, connectionId, userId, forUpdate = false) {
  const [rows] = await db.execute(`SELECT c.id,c.company_id,c.candidate_user_id,c.initiated_by,c.status,
      co.owner_user_id AS company_owner_id,co.name AS company_name,co.verified_at AS company_verified_at,
      candidate_user.status AS candidate_status,company_owner.status AS company_owner_status
    FROM connections c JOIN companies co ON co.id=c.company_id
    JOIN users candidate_user ON candidate_user.id=c.candidate_user_id
    JOIN users company_owner ON company_owner.id=co.owner_user_id
    WHERE c.id=? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`, [connectionId]);
  const row = rows[0];
  if (!row) return null;
  if (row.candidate_user_id !== userId && row.company_owner_id !== userId) return false;
  if (row.candidate_status !== 'active' || row.company_owner_status !== 'active') return null;
  return row;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'candidate') {
      const [rows] = await getPool().execute(`SELECT c.id,c.company_id AS companyId,c.initiated_by AS initiatedBy,c.status,
          c.invitation_message AS invitationMessage,c.created_at AS createdAt,c.updated_at AS updatedAt,
          co.name AS companyName,co.sector,co.city,co.state,
          (SELECT COUNT(*) FROM connection_messages m WHERE m.connection_id=c.id AND m.recipient_user_id=? AND m.read_at IS NULL) AS unreadMessages
        FROM connections c JOIN companies co ON co.id=c.company_id
        WHERE c.candidate_user_id=? ORDER BY c.updated_at DESC LIMIT 100`, [req.user.sub, req.user.sub]);
      return res.json({ connections: rows });
    }
    if (req.user.role === 'company') {
      const [rows] = await getPool().execute(`SELECT c.id,c.company_id AS companyId,c.candidate_user_id AS candidateUserId,
          c.initiated_by AS initiatedBy,c.status,c.invitation_message AS invitationMessage,
          c.created_at AS createdAt,c.updated_at AS updatedAt,u.name AS candidateName,
          p.city,p.state,p.education,p.skills,
          (SELECT COUNT(*) FROM connection_messages m WHERE m.connection_id=c.id AND m.recipient_user_id=? AND m.read_at IS NULL) AS unreadMessages
        FROM connections c JOIN companies co ON co.id=c.company_id
        JOIN users u ON u.id=c.candidate_user_id LEFT JOIN candidate_profiles p ON p.user_id=u.id
        WHERE co.owner_user_id=? AND c.status<>'blocked'
          AND (p.visibility=TRUE OR c.status='connected')
        ORDER BY c.updated_at DESC LIMIT 100`, [req.user.sub, req.user.sub]);
      return res.json({ connections: rows });
    }
    return res.status(403).json({ message: 'Esta área é exclusiva para candidatos e empresas.' });
  } catch (error) { next(error); }
});

router.post('/', connectionCreateRateLimit, authenticate, async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Confira os dados do convite ou apresentação.', errors: parsed.error.flatten().fieldErrors });
  let db;
  try {
    db = await getPool().getConnection();
    await db.beginTransaction();
    let company;
    let candidateId;
    let initiatedBy;
    let status;
    let invitationMessage = null;
    if (req.user.role === 'candidate') {
      if (!parsed.data.companyId) { await db.rollback(); return res.status(400).json({ message: 'Informe a empresa desejada.' }); }
      const [rows] = await db.execute(`SELECT c.id,c.owner_user_id,u.status AS owner_status,c.name,c.verified_at
        FROM companies c JOIN users u ON u.id=c.owner_user_id WHERE c.id=? LIMIT 1 FOR UPDATE`, [parsed.data.companyId]);
      company = rows[0];
      if (!company || company.owner_status !== 'active' || !company.verified_at) { await db.rollback(); return res.status(404).json({ message: 'Empresa não verificada ou indisponível para conexões.' }); }
      const [candidateRows] = await db.execute("SELECT id FROM users WHERE id=? AND role='candidate' AND status='active' LIMIT 1 FOR UPDATE", [req.user.sub]);
      if (!candidateRows.length) { await db.rollback(); return res.status(403).json({ message: 'Conta de candidato indisponível.' }); }
      candidateId = req.user.sub;
      initiatedBy = 'candidate';
      status = 'connected';
    } else if (req.user.role === 'company') {
      if (!parsed.data.candidateUserId) { await db.rollback(); return res.status(400).json({ message: 'Informe o perfil convidado.' }); }
      const [companyRows] = await db.execute(`SELECT c.id,c.owner_user_id,c.name,u.status AS owner_status,c.verified_at
        FROM companies c JOIN users u ON u.id=c.owner_user_id WHERE c.owner_user_id=? LIMIT 1 FOR UPDATE`, [req.user.sub]);
      company = companyRows[0];
      if (!company || company.owner_status !== 'active' || !company.verified_at) { await db.rollback(); return res.status(403).json({ message: 'Perfil empresarial não verificado ou indisponível para convites.' }); }
      const [candidateRows] = await db.execute(`SELECT u.id FROM users u JOIN candidate_profiles p ON p.user_id=u.id
        WHERE u.id=? AND u.role='candidate' AND u.status='active' AND p.visibility=TRUE LIMIT 1 FOR UPDATE`, [parsed.data.candidateUserId]);
      if (!candidateRows.length) { await db.rollback(); return res.status(404).json({ message: 'Este candidato não está disponível no banco de talentos.' }); }
      candidateId = parsed.data.candidateUserId;
      initiatedBy = 'company';
      status = 'pending';
      invitationMessage = parsed.data.message;
    } else {
      await db.rollback();
      return res.status(403).json({ message: 'Apenas candidatos e empresas podem iniciar conexões.' });
    }

    const connectionId = randomUUID();
    await db.execute(`INSERT INTO connections (id,company_id,candidate_user_id,initiated_by,status,invitation_message)
      VALUES (?,?,?,?,?,?)`, [connectionId, company.id, candidateId, initiatedBy, status, invitationMessage]);
    if (initiatedBy === 'candidate') {
      await db.execute(`INSERT INTO connection_messages (id,connection_id,sender_user_id,recipient_user_id,body)
        VALUES (?,?,?,?,?)`, [randomUUID(), connectionId, candidateId, company.owner_user_id, parsed.data.message]);
      await addNotification(db, company.owner_user_id, 'message', 'Nova apresentação profissional', 'Um candidato iniciou uma conexão e enviou uma apresentação.', connectionId);
    } else {
      await addNotification(db, candidateId, 'connection', 'Convite de empresa', `${company.name} enviou um convite. Aceite para iniciar uma conversa; você pode recusar sem compartilhar contato.`, connectionId);
    }
    await db.commit();
    res.status(201).json({ connection: { id: connectionId, companyId: company.id, candidateUserId: candidateId, initiatedBy, status } });
  } catch (error) {
    if (db) { try { await db.rollback(); } catch {} }
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Já existe uma conexão ou convite entre estas contas.' });
    next(error);
  } finally { db?.release(); }
});

router.patch('/:connectionId', authenticate, async (req, res, next) => {
  const connectionId = uuid.safeParse(req.params.connectionId);
  const parsed = actionSchema.safeParse(req.body);
  if (!connectionId.success || !parsed.success) return res.status(400).json({ message: 'Ação de conexão inválida.' });
  let db;
  try {
    db = await getPool().getConnection();
    await db.beginTransaction();
    const connection = await findParticipantConnection(db, req.params.connectionId, req.user.sub, true);
    if (connection === false) { await db.rollback(); return res.status(403).json({ message: 'Esta conexão pertence a outras contas.' }); }
    if (!connection) { await db.rollback(); return res.status(404).json({ message: 'Conexão não encontrada.' }); }
    if (parsed.data.action === 'block') {
      if (connection.status === 'blocked') { await db.commit(); return res.json({ status: 'blocked' }); }
      await db.execute("UPDATE connections SET status='blocked',blocked_by_user_id=? WHERE id=?", [req.user.sub, connection.id]);
      const otherUserId = req.user.sub === connection.candidate_user_id ? connection.company_owner_id : connection.candidate_user_id;
      await db.execute('UPDATE connection_messages SET read_at=COALESCE(read_at,UTC_TIMESTAMP()) WHERE connection_id=?', [connection.id]);
      await addNotification(db, otherUserId, 'connection', 'Conexão encerrada', 'A outra parte encerrou esta conexão.', connection.id);
      await db.commit();
      return res.json({ status: 'blocked' });
    }
    if (req.user.role !== 'candidate' || req.user.sub !== connection.candidate_user_id || connection.status !== 'pending' || connection.initiated_by !== 'company') {
      await db.rollback();
      return res.status(403).json({ message: 'Somente o candidato pode responder a um convite pendente.' });
    }
    if (parsed.data.action === 'accept' && !connection.company_verified_at) {
      await db.rollback();
      return res.status(409).json({ message: 'A conexão não pode ser aceita enquanto a empresa estiver sem verificação ativa.' });
    }
    const status = parsed.data.action === 'accept' ? 'connected' : 'declined';
    const [result] = await db.execute("UPDATE connections SET status=? WHERE id=? AND status='pending' AND initiated_by='company'", [status, connection.id]);
    if (!result.affectedRows) { await db.rollback(); return res.status(409).json({ message: 'Este convite já foi respondido.' }); }
    await addNotification(db, connection.company_owner_id, 'connection', status === 'connected' ? 'Convite aceito' : 'Convite recusado', `O candidato ${status === 'connected' ? 'aceitou' : 'recusou'} o convite de conexão.`, connection.id);
    await db.commit();
    res.json({ status });
  } catch (error) {
    if (db) { try { await db.rollback(); } catch {} }
    next(error);
  } finally { db?.release(); }
});

router.get('/:connectionId/messages', authenticate, async (req, res, next) => {
  const parsedId = uuid.safeParse(req.params.connectionId);
  if (!parsedId.success) return res.status(400).json({ message: 'Identificador de conexão inválido.' });
  try {
    const pool = getPool();
    const connection = await findParticipantConnection(pool, req.params.connectionId, req.user.sub);
    if (connection === false) return res.status(403).json({ message: 'Esta conversa pertence a outras contas.' });
    if (!connection) return res.status(404).json({ message: 'Conversa não encontrada.' });
    await pool.execute('UPDATE connection_messages SET read_at=UTC_TIMESTAMP() WHERE connection_id=? AND recipient_user_id=? AND read_at IS NULL', [connection.id, req.user.sub]);
    const [messages] = await pool.execute(`SELECT m.id,m.sender_user_id AS senderUserId,m.recipient_user_id AS recipientUserId,
        u.name AS senderName,m.body,m.created_at AS createdAt,m.read_at AS readAt
      FROM connection_messages m JOIN users u ON u.id=m.sender_user_id
      WHERE m.connection_id=? ORDER BY m.created_at ASC LIMIT 500`, [connection.id]);
    res.json({ messages });
  } catch (error) { next(error); }
});

router.post('/:connectionId/messages', messageRateLimit, authenticate, async (req, res, next) => {
  const parsedId = uuid.safeParse(req.params.connectionId);
  const parsed = messageSchema.safeParse(req.body);
  if (!parsedId.success || !parsed.success) return res.status(400).json({ message: 'Mensagem inválida.' });
  let db;
  try {
    db = await getPool().getConnection();
    await db.beginTransaction();
    const connection = await findParticipantConnection(db, req.params.connectionId, req.user.sub, true);
    if (connection === false) { await db.rollback(); return res.status(403).json({ message: 'Esta conversa pertence a outras contas.' }); }
    if (!connection) { await db.rollback(); return res.status(404).json({ message: 'Conversa não encontrada.' }); }
    if (!connection.company_verified_at) {
      await db.rollback();
      return res.status(409).json({ message: 'A conversa foi suspensa enquanto a empresa não estiver verificada.' });
    }
    if (connection.status !== 'connected') {
      await db.rollback();
      return res.status(409).json({ message: 'A conversa só é liberada após a conexão ser aceita.' });
    }
    const recipientId = req.user.sub === connection.candidate_user_id ? connection.company_owner_id : connection.candidate_user_id;
    const messageId = randomUUID();
    await db.execute(`INSERT INTO connection_messages (id,connection_id,sender_user_id,recipient_user_id,body)
      VALUES (?,?,?,?,?)`, [messageId, connection.id, req.user.sub, recipientId, parsed.data.body]);
    await addNotification(db, recipientId, 'message', 'Nova mensagem', `Você recebeu uma mensagem de ${req.user.role === 'company' ? 'uma empresa' : 'um candidato'}.`, connection.id);
    await db.commit();
    res.status(201).json({ message: { id: messageId, connectionId: connection.id, senderUserId: req.user.sub, recipientUserId: recipientId, body: parsed.data.body, createdAt: new Date().toISOString() } });
  } catch (error) {
    if (db) { try { await db.rollback(); } catch {} }
    next(error);
  } finally { db?.release(); }
});

export default router;
