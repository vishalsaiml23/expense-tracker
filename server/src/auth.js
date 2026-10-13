import jwt from 'jsonwebtoken';

const sessionTokenFromRequest = (req) => {
  const authHeader = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (authHeader) return authHeader;

  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith('moneta_session='));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice('moneta_session='.length));
};

export function requireAuth(req, res, next) {
  const token = sessionTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
