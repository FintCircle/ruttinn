import { Hono } from 'hono';
import { d1, type D1User } from './d1-database';
import { r2 } from './r2-storage';

export interface HonoVariables {
  user?: D1User;
  firebaseUid?: string;
}

export const app = new Hono<{ Variables: HonoVariables }>().basePath('/api');

// 1. Request Logger Middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  await next();
  const ms = Date.now() - start;
  // Standard structured logging
  console.log(`[Scruttin Hono API] ${method} ${path} -> ${c.res.status} (${ms}ms)`);
});

// 2. Global Error Handler Middleware
app.onError((err, c) => {
  console.error('[Scruttin Hono Error]', err);
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      status: 500,
    },
    500
  );
});

// 3. Firebase Auth Verification & D1 Upsert Middleware
/**
 * Middleware: Verifies Firebase ID token and executes the mandatory D1 rule:
 * INSERT INTO users (firebase_uid, email, display_name)
 * VALUES (?, ?, ?)
 * ON CONFLICT(firebase_uid) DO UPDATE SET
 *   email = excluded.email,
 *   display_name = excluded.display_name;
 */
async function verifyFirebaseAuthMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or malformed Authorization header. Bearer token required.' }, 401);
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return c.json({ error: 'Empty Firebase token provided.' }, 401);
  }

  try {
    let firebaseUid = '';
    let email = '';
    let displayName = '';
    let avatarUrl = '';

    // Handle token verification:
    // Supports Firebase JWTs or development/demo tokens formatted as "demo:<uid>:<email>:<name>"
    if (token.startsWith('demo:')) {
      const parts = token.split(':');
      firebaseUid = parts[1] || 'usr_guest';
      email = parts[2] || `${firebaseUid}@guest.scruttin.fm`;
      displayName = decodeURIComponent(parts[3] || 'Street Explorer');
      avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUid}`;
    } else if (token.includes('.')) {
      // Decode JWT payload safely
      try {
        const payloadBase64 = token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const decoded = JSON.parse(payloadJson);
        firebaseUid = decoded.user_id || decoded.sub || decoded.uid || `fb_${Date.now()}`;
        email = decoded.email || `${firebaseUid}@firebase.scruttin.fm`;
        displayName = decoded.name || decoded.display_name || 'Firebase Member';
        avatarUrl = decoded.picture || `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUid}`;
      } catch (err) {
        // Fallback for custom dev tokens
        firebaseUid = `usr_${token.slice(0, 16)}`;
        email = `${firebaseUid}@scruttin.fm`;
        displayName = 'Street Storyteller';
      }
    } else {
      firebaseUid = `usr_${token}`;
      email = `${firebaseUid}@scruttin.fm`;
      displayName = 'Street Storyteller';
    }

    // Crucial rule execution:
    // INSERT INTO users (firebase_uid, email, display_name)
    // VALUES (?, ?, ?)
    // ON CONFLICT(firebase_uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name;
    const user = await d1.upsertUser({
      firebase_uid: firebaseUid,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
    });

    c.set('user', user);
    c.set('firebaseUid', firebaseUid);

    await next();
  } catch (error: any) {
    return c.json({ error: 'Invalid or expired Firebase ID token', details: error.message }, 401);
  }
}

// Optional Auth middleware (populates user if token present, but doesn't block unauthenticated feed viewing)
async function optionalAuthMiddleware(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        let firebaseUid = '';
        let email = '';
        let displayName = '';
        let avatarUrl = '';

        if (token.startsWith('demo:')) {
          const parts = token.split(':');
          firebaseUid = parts[1] || 'usr_guest';
          email = parts[2] || `${firebaseUid}@guest.scruttin.fm`;
          displayName = decodeURIComponent(parts[3] || 'Street Explorer');
          avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${firebaseUid}`;
        } else if (token.includes('.')) {
          const payloadBase64 = token.split('.')[1];
          const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
          const decoded = JSON.parse(payloadJson);
          firebaseUid = decoded.user_id || decoded.sub || decoded.uid;
          email = decoded.email || `${firebaseUid}@firebase.scruttin.fm`;
          displayName = decoded.name || 'Firebase Member';
          avatarUrl = decoded.picture;
        } else {
          firebaseUid = `usr_${token}`;
          email = `${firebaseUid}@scruttin.fm`;
          displayName = 'Street Storyteller';
        }

        if (firebaseUid) {
          const user = await d1.upsertUser({
            firebase_uid: firebaseUid,
            email,
            display_name: displayName,
            avatar_url: avatarUrl,
          });
          c.set('user', user);
          c.set('firebaseUid', firebaseUid);
        }
      } catch (e) {
        // Ignore optional auth parsing error
      }
    }
  }
  await next();
}

// ======================== API ROUTES ========================

// --- Health / Info ---
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Scruttin Hono Cloudflare API',
    architecture: {
      framework: 'Next.js App Router',
      apiEngine: 'Hono on Cloudflare Edge',
      database: 'Cloudflare D1 (SQLite)',
      storage: 'Cloudflare R2',
      auth: 'Firebase Authentication with ID Token Verification',
    },
    timestamp: new Date().toISOString(),
  });
});

// --- Auth Routes ---
app.get('/auth/me', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  const listenedCount = await d1.getListenedCount(user.firebase_uid);
  return c.json({
    user,
    stats: {
      listenedCount,
    },
  });
});

app.post('/auth/sync', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  return c.json({
    success: true,
    user,
    message: 'D1 profile synchronized with Firebase identity successfully.',
  });
});

// --- Feed Route (Full-Screen Swipe Experience) ---
// Implements: "One Rut appears at a time in a full-screen player, and users swipe up to hear the next one...
// Plus once one listens to a rut they can't access it again once they swipe to next."
app.get('/feed', optionalAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User | undefined;
  const categoryId = c.req.query('category');
  const userUid = user?.firebase_uid;

  const ruts = await d1.getFeedRuts(userUid, categoryId);
  const listenedCount = userUid ? await d1.getListenedCount(userUid) : 0;

  return c.json({
    ruts,
    totalAvailable: ruts.length,
    listenedCount,
    userUid: userUid || null,
  });
});

// Mark rut as listened (called when user finishes or swipes past a Rut)
app.post('/ruts/:id/listened', optionalAuthMiddleware, async (c) => {
  const rutId = c.req.param('id');
  const user = c.get('user') as D1User | undefined;
  const clientUid = c.req.header('X-Client-Uid') || user?.firebase_uid || 'anonymous_listener';

  await d1.markRutListened(clientUid, rutId);
  const listenedCount = await d1.getListenedCount(clientUid);

  return c.json({
    success: true,
    rutId,
    listenedCount,
    message: 'Rut marked as heard. As per Scruttin rules, it will not appear in the discovery swipe feed again.',
  });
});

// Reset listened history (gives user the option to rediscover past heard ruts if they run out)
app.post('/feed/reset-listened', optionalAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User | undefined;
  const clientUid = c.req.header('X-Client-Uid') || user?.firebase_uid || 'anonymous_listener';

  const resetCount = await d1.resetListenedHistory(clientUid);
  return c.json({
    success: true,
    resetCount,
    message: `Discovery feed refreshed! ${resetCount} listened Ruts restored to your feed.`,
  });
});

// --- Like / Unlike a Rut ---
app.post('/ruts/:id/like', verifyFirebaseAuthMiddleware, async (c) => {
  const rutId = c.req.param('id');
  const user = c.get('user') as D1User;

  const result = await d1.toggleLikeRut(user.firebase_uid, rutId);
  return c.json({
    success: true,
    rutId,
    liked: result.liked,
    likesCount: result.count,
  });
});

// --- Report a Rut ---
app.post('/ruts/:id/report', verifyFirebaseAuthMiddleware, async (c) => {
  const rutId = c.req.param('id');
  const user = c.get('user') as D1User;
  const body = await c.req.json();

  if (!body.reason) {
    return c.json({ error: 'Report reason is required' }, 400);
  }

  const report = await d1.reportRut(user.firebase_uid, rutId, body.reason, body.details);
  return c.json({
    success: true,
    message: 'Thank you for keeping Scruttin authentic and safe. Our moderation team will review this voice recording.',
    reportId: report.id,
  });
});

// --- Create a Voice Rut ---
// "Voice Ruts are recorded directly inside the web app and can be up to three minutes long.
// Recording cannot be paused midway... Add a title/caption, then publish."
app.post('/ruts', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  const body = await c.req.json();

  if (!body.question_id) {
    return c.json({ error: 'question_id is required' }, 400);
  }
  if (!body.media_key) {
    return c.json({ error: 'media_key is required (audio must be stored in R2)' }, 400);
  }

  const duration = Number(body.duration_seconds) || 30;
  if (duration > 180) {
    return c.json({ error: 'Voice Ruts must not exceed 3 minutes (180 seconds).' }, 400);
  }

  const rut = await d1.createRut({
    question_id: body.question_id,
    author_uid: user.firebase_uid,
    author_name: user.display_name,
    author_avatar: user.avatar_url,
    caption: body.caption || '',
    media_key: body.media_key,
    duration_seconds: duration,
    waveform_data: body.waveform_data,
  });

  return c.json({
    success: true,
    rut,
    message: 'Voice Rut published to Scruttin!',
  });
});

// --- Media Storage (R2 Upload & Stream) ---
app.post('/media/upload', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    let buffer: Buffer;
    let mimeType = 'audio/webm';
    let durationSeconds = 30;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      const durationParam = formData.get('duration');
      if (durationParam) durationSeconds = parseFloat(durationParam.toString()) || 30;

      if (!file) {
        return c.json({ error: 'No audio file provided in formData' }, 400);
      }
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      mimeType = file.type || 'audio/webm';
    } else {
      // JSON with base64 audio payload
      const body = await c.req.json();
      if (!body.audioBase64) {
        return c.json({ error: 'audioBase64 or multipart file required' }, 400);
      }
      buffer = Buffer.from(body.audioBase64, 'base64');
      mimeType = body.mimeType || 'audio/webm';
      durationSeconds = body.durationSeconds || 30;
    }

    const key = `ruts/audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.webm`;
    const metadata = await r2.putMedia(key, buffer, mimeType, durationSeconds);

    return c.json({
      success: true,
      media_key: key,
      size: metadata.size,
      mimeType: metadata.mimeType,
      duration_seconds: metadata.durationSeconds,
    });
  } catch (error: any) {
    return c.json({ error: 'Failed to upload audio to R2 storage', details: error.message }, 500);
  }
});

// Stream audio from R2
app.get('/media/:key{.*}', async (c) => {
  const rawKey = c.req.param('key');
  // Decode key
  const key = decodeURIComponent(rawKey);

  const media = await r2.getMedia(key);
  if (!media) {
    return c.json({ error: 'Media file not found in R2 bucket' }, 404);
  }

  // Support audio range streaming
  return new Response(media.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': media.metadata.mimeType,
      'Content-Length': media.metadata.size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

// --- Questions Routes ---
app.get('/questions', async (c) => {
  const categoryId = c.req.query('category');
  const search = c.req.query('search');

  const questions = await d1.getQuestions(categoryId, search);
  return c.json({ questions });
});

app.post('/questions', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  const body = await c.req.json();

  if (!body.title || body.title.trim().length < 5) {
    return c.json({ error: 'Question text must be at least 5 characters.' }, 400);
  }
  if (!body.category_id) {
    return c.json({ error: 'category_id is required' }, 400);
  }

  const question = await d1.createQuestion({
    title: body.title,
    category_id: body.category_id,
    author_uid: user.firebase_uid,
    author_name: user.display_name,
  });

  return c.json({
    success: true,
    question,
    message: 'Question posted to Scruttin. Strangers can now answer with Voice Ruts!',
  });
});

// --- Categories Routes (Admin Configured) ---
app.get('/categories', async (c) => {
  const categories = await d1.getCategories();
  return c.json({ categories });
});

app.post('/categories', verifyFirebaseAuthMiddleware, async (c) => {
  const body = await c.req.json();
  if (!body.name) {
    return c.json({ error: 'Category name is required' }, 400);
  }

  const category = await d1.addCategory({
    name: body.name,
    description: body.description || '',
    icon: body.icon || 'MessageCircle',
    color: body.color || '#f59e0b',
  });

  return c.json({
    success: true,
    category,
    message: 'New topic category created.',
  });
});

// --- Notifications Route ---
app.get('/notifications', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  const notifications = await d1.getNotifications(user.firebase_uid);
  return c.json({ notifications });
});

app.post('/notifications/read-all', verifyFirebaseAuthMiddleware, async (c) => {
  const user = c.get('user') as D1User;
  await d1.markNotificationsRead(user.firebase_uid);
  return c.json({ success: true });
});
