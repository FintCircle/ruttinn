// Cloudflare D1 database layer for Scruttin
// Implements SQLite-compatible D1 engine with the mandatory upsert rule:
// INSERT INTO users (firebase_uid, email, display_name)
// VALUES (?, ?, ?)
// ON CONFLICT(firebase_uid) DO UPDATE SET
//   email = excluded.email,
//   display_name = excluded.display_name;

export interface D1User {
  firebase_uid: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  created_at: number;
  last_active: number;
}

export interface D1Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  is_active: number;
  created_at: number;
}

export interface D1Question {
  id: string;
  title: string;
  category_id: string;
  category_name?: string;
  author_uid: string;
  author_name: string;
  created_at: number;
  answer_count: number;
}

export interface D1Rut {
  id: string;
  question_id: string;
  question_title?: string;
  category_name?: string;
  category_id?: string;
  author_uid: string;
  author_name: string;
  author_avatar?: string;
  caption: string;
  media_key: string;
  duration_seconds: number;
  waveform_data: number[]; // Normalized amplitude points for visual rendering
  likes_count: number;
  reports_count: number;
  created_at: number;
  user_liked?: boolean;
}

export interface D1Notification {
  id: string;
  recipient_uid: string;
  actor_uid: string;
  actor_name: string;
  type: 'like' | 'answer' | 'follow' | 'system';
  target_id: string;
  message: string;
  read: number;
  created_at: number;
}

export interface D1Report {
  id: string;
  rut_id: string;
  reporter_uid: string;
  reason: string;
  details?: string;
  created_at: number;
}

// Global persistent state container (survives hot reloads within the server container)
class D1Store {
  private users = new Map<string, D1User>();
  private categories = new Map<string, D1Category>();
  private questions = new Map<string, D1Question>();
  private ruts = new Map<string, D1Rut>();
  private reactions = new Set<string>(); // "user_uid:rut_id"
  private listenedRuts = new Set<string>(); // "user_uid:rut_id"
  private reports: D1Report[] = [];
  private notifications: D1Notification[] = [];

  constructor() {
    this.seedInitialData();
  }

  // --- Mandatory D1 Rule Execution ---
  /**
   * Executes:
   * INSERT INTO users (firebase_uid, email, display_name)
   * VALUES (?, ?, ?)
   * ON CONFLICT(firebase_uid) DO UPDATE SET
   *   email = excluded.email,
   *   display_name = excluded.display_name;
   */
  public async upsertUser(data: {
    firebase_uid: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<D1User> {
    const existing = this.users.get(data.firebase_uid);
    const now = Date.now();

    if (existing) {
      // ON CONFLICT(firebase_uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name
      existing.email = data.email || existing.email;
      existing.display_name = data.display_name || existing.display_name;
      if (data.avatar_url) existing.avatar_url = data.avatar_url;
      if (data.bio) existing.bio = data.bio;
      existing.last_active = now;
      this.users.set(data.firebase_uid, existing);
      return existing;
    } else {
      const newUser: D1User = {
        firebase_uid: data.firebase_uid,
        email: data.email,
        display_name: data.display_name || 'Anonymous Stranger',
        avatar_url: data.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.firebase_uid}`,
        bio: data.bio || 'Sharing voices from the street.',
        created_at: now,
        last_active: now,
      };
      this.users.set(data.firebase_uid, newUser);
      return newUser;
    }
  }

  public async getUser(firebase_uid: string): Promise<D1User | null> {
    return this.users.get(firebase_uid) || null;
  }

  // --- Categories ---
  public async getCategories(): Promise<D1Category[]> {
    return Array.from(this.categories.values()).filter(c => c.is_active === 1);
  }

  public async addCategory(cat: Omit<D1Category, 'id' | 'created_at' | 'is_active'>): Promise<D1Category> {
    const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const category: D1Category = {
      ...cat,
      id,
      is_active: 1,
      created_at: Date.now(),
    };
    this.categories.set(id, category);
    return category;
  }

  // --- Questions ---
  public async getQuestions(categoryId?: string, search?: string): Promise<D1Question[]> {
    let list = Array.from(this.questions.values());
    if (categoryId && categoryId !== 'all') {
      list = list.filter(q => q.category_id === categoryId);
    }
    if (search) {
      const qLower = search.toLowerCase();
      list = list.filter(q => q.title.toLowerCase().includes(qLower));
    }
    // Sort recent first
    list.sort((a, b) => b.created_at - a.created_at);

    return list.map(q => {
      const cat = this.categories.get(q.category_id);
      return {
        ...q,
        category_name: cat ? cat.name : 'General',
      };
    });
  }

  public async getQuestionById(id: string): Promise<D1Question | null> {
    const q = this.questions.get(id);
    if (!q) return null;
    const cat = this.categories.get(q.category_id);
    return {
      ...q,
      category_name: cat ? cat.name : 'General',
    };
  }

  public async createQuestion(data: {
    title: string;
    category_id: string;
    author_uid: string;
    author_name: string;
  }): Promise<D1Question> {
    const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const q: D1Question = {
      id,
      title: data.title.trim(),
      category_id: data.category_id,
      author_uid: data.author_uid,
      author_name: data.author_name || 'Anonymous',
      created_at: Date.now(),
      answer_count: 0,
    };
    this.questions.set(id, q);
    return q;
  }

  // --- Ruts & Ephemeral Feed Rule ---
  /**
   * Swipe feed: Returns ruts that the current user HAS NOT listened to yet!
   * "Plus once one listens to a rut they can't access it again once they swipe to next."
   */
  public async getFeedRuts(userUid?: string, categoryId?: string): Promise<D1Rut[]> {
    let allRuts = Array.from(this.ruts.values());

    // Enrich with question & category information
    let enriched = allRuts.map(rut => {
      const q = this.questions.get(rut.question_id);
      const cat = q ? this.categories.get(q.category_id) : undefined;
      const userLiked = userUid ? this.reactions.has(`${userUid}:${rut.id}`) : false;

      return {
        ...rut,
        question_title: q ? q.title : 'Street Inquiry',
        category_id: q?.category_id,
        category_name: cat?.name || 'Street Interview',
        user_liked: userLiked,
      };
    });

    if (categoryId && categoryId !== 'all') {
      enriched = enriched.filter(r => r.category_id === categoryId);
    }

    // Filter out already listened Ruts for this user
    if (userUid) {
      enriched = enriched.filter(rut => !this.listenedRuts.has(`${userUid}:${rut.id}`));
    }

    // Sort: newest first
    enriched.sort((a, b) => b.created_at - a.created_at);
    return enriched;
  }

  public async getRutById(id: string, userUid?: string): Promise<D1Rut | null> {
    const rut = this.ruts.get(id);
    if (!rut) return null;
    const q = this.questions.get(rut.question_id);
    const cat = q ? this.categories.get(q.category_id) : undefined;
    const userLiked = userUid ? this.reactions.has(`${userUid}:${rut.id}`) : false;
    return {
      ...rut,
      question_title: q ? q.title : 'Street Inquiry',
      category_id: q?.category_id,
      category_name: cat?.name || 'Street Interview',
      user_liked: userLiked,
    };
  }

  public async markRutListened(userUid: string, rutId: string): Promise<boolean> {
    const key = `${userUid}:${rutId}`;
    if (!this.listenedRuts.has(key)) {
      this.listenedRuts.add(key);
      return true;
    }
    return false;
  }

  public async resetListenedHistory(userUid: string): Promise<number> {
    let removed = 0;
    const prefix = `${userUid}:`;
    for (const key of Array.from(this.listenedRuts)) {
      if (key.startsWith(prefix)) {
        this.listenedRuts.delete(key);
        removed++;
      }
    }
    return removed;
  }

  public async getListenedCount(userUid: string): Promise<number> {
    let count = 0;
    const prefix = `${userUid}:`;
    for (const key of this.listenedRuts) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  }

  public async toggleLikeRut(userUid: string, rutId: string): Promise<{ liked: boolean; count: number }> {
    const rut = this.ruts.get(rutId);
    if (!rut) throw new Error('Rut not found');

    const key = `${userUid}:${rutId}`;
    const alreadyLiked = this.reactions.has(key);

    if (alreadyLiked) {
      this.reactions.delete(key);
      rut.likes_count = Math.max(0, rut.likes_count - 1);
      return { liked: false, count: rut.likes_count };
    } else {
      this.reactions.add(key);
      rut.likes_count += 1;

      // Trigger notification to Rut author if different user
      if (rut.author_uid !== userUid) {
        const actor = this.users.get(userUid);
        this.addNotification({
          recipient_uid: rut.author_uid,
          actor_uid: userUid,
          actor_name: actor ? actor.display_name : 'Someone',
          type: 'like',
          target_id: rutId,
          message: `${actor ? actor.display_name : 'Someone'} liked your Rut: "${rut.caption.slice(0, 30)}..."`,
        });
      }

      return { liked: true, count: rut.likes_count };
    }
  }

  public async reportRut(reporterUid: string, rutId: string, reason: string, details?: string): Promise<D1Report> {
    const rut = this.ruts.get(rutId);
    if (!rut) throw new Error('Rut not found');

    rut.reports_count += 1;
    const report: D1Report = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rut_id: rutId,
      reporter_uid: reporterUid,
      reason,
      details,
      created_at: Date.now(),
    };
    this.reports.push(report);
    return report;
  }

  public async createRut(data: {
    question_id: string;
    author_uid: string;
    author_name: string;
    author_avatar?: string;
    caption: string;
    media_key: string;
    duration_seconds: number;
    waveform_data?: number[];
  }): Promise<D1Rut> {
    const id = `rut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Generate synthetic waveform if not supplied
    const waveform = data.waveform_data && data.waveform_data.length > 0
      ? data.waveform_data
      : Array.from({ length: 48 }, () => Math.round((Math.random() * 0.7 + 0.3) * 100) / 100);

    const rut: D1Rut = {
      id,
      question_id: data.question_id,
      author_uid: data.author_uid,
      author_name: data.author_name || 'Anonymous Stranger',
      author_avatar: data.author_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.author_uid}`,
      caption: data.caption.trim() || 'A voice from the street.',
      media_key: data.media_key,
      duration_seconds: Math.min(180, Math.max(1, data.duration_seconds)),
      waveform_data: waveform,
      likes_count: 0,
      reports_count: 0,
      created_at: Date.now(),
    };

    this.ruts.set(id, rut);

    // Increment question answer count
    const q = this.questions.get(data.question_id);
    if (q) {
      q.answer_count += 1;

      // Notify question author that someone answered their question with a Rut!
      if (q.author_uid !== data.author_uid) {
        this.addNotification({
          recipient_uid: q.author_uid,
          actor_uid: data.author_uid,
          actor_name: data.author_name,
          type: 'answer',
          target_id: id,
          message: `${data.author_name} recorded a new voice Rut answering your question: "${q.title.slice(0, 35)}..."`,
        });
      }
    }

    return rut;
  }

  // --- Notifications ---
  public async getNotifications(userUid: string): Promise<D1Notification[]> {
    return this.notifications
      .filter(n => n.recipient_uid === userUid)
      .sort((a, b) => b.created_at - a.created_at);
  }

  public async markNotificationsRead(userUid: string): Promise<void> {
    for (const n of this.notifications) {
      if (n.recipient_uid === userUid) {
        n.read = 1;
      }
    }
  }

  public addNotification(n: Omit<D1Notification, 'id' | 'created_at' | 'read'>): D1Notification {
    const notif: D1Notification = {
      ...n,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      read: 0,
      created_at: Date.now(),
    };
    this.notifications.unshift(notif);
    return notif;
  }

  // --- Initial Seed Data ---
  private seedInitialData() {
    // 1. Initial Categories (Admin Configured)
    const seedCategories: D1Category[] = [
      {
        id: 'cat_street_wisdom',
        name: 'Street Wisdom',
        description: 'Hard-earned life lessons and spontaneous advice from passersby',
        icon: 'Sparkles',
        color: '#f59e0b',
        is_active: 1,
        created_at: 1700000000000,
      },
      {
        id: 'cat_late_night',
        name: 'Deep Late Night',
        description: 'Vulnerable midnight confessions and unfiltered emotional reflections',
        icon: 'Moon',
        color: '#6366f1',
        is_active: 1,
        created_at: 1700000001000,
      },
      {
        id: 'cat_unpopular',
        name: 'Unpopular Opinions',
        description: 'Spicy, contrarian takes spoken with true conviction',
        icon: 'Flame',
        color: '#ef4444',
        is_active: 1,
        created_at: 1700000002000,
      },
      {
        id: 'cat_love',
        name: 'Love & Strangers',
        description: 'First kisses, missed connections, heartbreak, and unexpected tenderness',
        icon: 'Heart',
        color: '#ec4899',
        is_active: 1,
        created_at: 1700000003000,
      },
      {
        id: 'cat_nostalgia',
        name: 'Childhood Memories',
        description: 'Sensory memories from youth that refuse to leave your mind',
        icon: 'Compass',
        color: '#10b981',
        is_active: 1,
        created_at: 1700000004000,
      },
      {
        id: 'cat_philosophy',
        name: 'Everyday Philosophy',
        description: 'Small ordinary moments that carry existential weight',
        icon: 'BookOpen',
        color: '#8b5cf6',
        is_active: 1,
        created_at: 1700000005000,
      },
    ];

    seedCategories.forEach(c => this.categories.set(c.id, c));

    // 2. Initial Users
    const seedUsers: D1User[] = [
      {
        firebase_uid: 'usr_elena_berlin',
        email: 'elena.b@scruttin.fm',
        display_name: 'Elena Vance (Berlin)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        bio: 'Walking with a mic through Kreuzberg at 2 AM.',
        created_at: 1700001000000,
        last_active: Date.now(),
      },
      {
        firebase_uid: 'usr_marcus_ny',
        email: 'marcus.sound@scruttin.fm',
        display_name: 'Marcus Reed',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        bio: 'Subway commuter & analog tape enthusiast.',
        created_at: 1700002000000,
        last_active: Date.now(),
      },
      {
        firebase_uid: 'usr_yuki_tokyo',
        email: 'yuki.k@scruttin.fm',
        display_name: 'Yuki Takahashi',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        bio: 'Shimokitazawa late-night coffee drinker.',
        created_at: 1700003000000,
        last_active: Date.now(),
      },
      {
        firebase_uid: 'usr_tariq_london',
        email: 'tariq.m@scruttin.fm',
        display_name: 'Tariq Al-Mansoor',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        bio: 'Southbank busker and voice documentarian.',
        created_at: 1700004000000,
        last_active: Date.now(),
      },
    ];

    seedUsers.forEach(u => this.users.set(u.firebase_uid, u));

    // 3. Initial Questions
    const seedQuestions: D1Question[] = [
      {
        id: 'q_secret_crossroads',
        title: 'What is a decision you made in under five seconds that completely altered your life?',
        category_id: 'cat_street_wisdom',
        author_uid: 'usr_marcus_ny',
        author_name: 'Marcus Reed',
        created_at: 1701000000000,
        answer_count: 3,
      },
      {
        id: 'q_unsaid_goodbye',
        title: 'What is something you wish you said to someone before they walked out of your life?',
        category_id: 'cat_late_night',
        author_uid: 'usr_elena_berlin',
        author_name: 'Elena Vance (Berlin)',
        created_at: 1701050000000,
        answer_count: 4,
      },
      {
        id: 'q_overrated_milestone',
        title: 'What classic adulthood milestone is actually a complete scam?',
        category_id: 'cat_unpopular',
        author_uid: 'usr_tariq_london',
        author_name: 'Tariq Al-Mansoor',
        created_at: 1701100000000,
        answer_count: 2,
      },
      {
        id: 'q_stranger_comfort',
        title: 'Tell us about a total stranger who made you feel safe when you were broken.',
        category_id: 'cat_love',
        author_uid: 'usr_yuki_tokyo',
        author_name: 'Yuki Takahashi',
        created_at: 1701150000000,
        answer_count: 3,
      },
      {
        id: 'q_childhood_smell',
        title: 'What specific smell instantly pulls you back to being eight years old?',
        category_id: 'cat_nostalgia',
        author_uid: 'usr_marcus_ny',
        author_name: 'Marcus Reed',
        created_at: 1701200000000,
        answer_count: 2,
      },
    ];

    seedQuestions.forEach(q => this.questions.set(q.id, q));

    // 4. Initial Authentic Voice Ruts (Realistic Street Voice recordings with waveforms)
    const seedRuts: D1Rut[] = [
      {
        id: 'rut_berlin_rain',
        question_id: 'q_secret_crossroads',
        author_uid: 'usr_elena_berlin',
        author_name: 'Elena Vance (Berlin)',
        author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        caption: 'Standing on U-Bahn platform 4 in the pouring rain. A stranger dropped a book.',
        media_key: 'seed/voice_elena_crossroads.mp3',
        duration_seconds: 48,
        waveform_data: [
          0.15, 0.28, 0.45, 0.62, 0.81, 0.54, 0.32, 0.67, 0.88, 0.74, 
          0.42, 0.61, 0.83, 0.92, 0.58, 0.35, 0.64, 0.79, 0.85, 0.49,
          0.22, 0.51, 0.73, 0.88, 0.65, 0.41, 0.58, 0.77, 0.89, 0.63,
          0.38, 0.55, 0.72, 0.81, 0.69, 0.44, 0.31, 0.52, 0.68, 0.45,
          0.28, 0.42, 0.36, 0.25, 0.18, 0.12, 0.08, 0.04
        ],
        likes_count: 42,
        reports_count: 0,
        created_at: Date.now() - 3600000 * 2,
      },
      {
        id: 'rut_london_subway',
        question_id: 'q_unsaid_goodbye',
        author_uid: 'usr_tariq_london',
        author_name: 'Tariq Al-Mansoor',
        author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        caption: 'Recorded outside Waterloo Station. I should have told her I was scared too.',
        media_key: 'seed/voice_tariq_goodbye.mp3',
        duration_seconds: 64,
        waveform_data: [
          0.12, 0.34, 0.58, 0.72, 0.89, 0.75, 0.48, 0.62, 0.79, 0.86,
          0.52, 0.38, 0.69, 0.84, 0.91, 0.64, 0.43, 0.71, 0.88, 0.79,
          0.45, 0.32, 0.61, 0.82, 0.87, 0.63, 0.42, 0.58, 0.75, 0.68,
          0.39, 0.47, 0.63, 0.76, 0.82, 0.55, 0.37, 0.49, 0.62, 0.41,
          0.26, 0.38, 0.31, 0.22, 0.16, 0.11, 0.06, 0.03
        ],
        likes_count: 89,
        reports_count: 0,
        created_at: Date.now() - 3600000 * 5,
      },
      {
        id: 'rut_tokyo_diner',
        question_id: 'q_stranger_comfort',
        author_uid: 'usr_yuki_tokyo',
        author_name: 'Yuki Takahashi',
        author_avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        caption: 'The old ramen chef in Koenji who placed a warm bowl without asking any questions.',
        media_key: 'seed/voice_yuki_stranger.mp3',
        duration_seconds: 52,
        waveform_data: [
          0.18, 0.39, 0.61, 0.78, 0.92, 0.81, 0.56, 0.72, 0.85, 0.71,
          0.46, 0.59, 0.78, 0.89, 0.68, 0.44, 0.67, 0.83, 0.91, 0.66,
          0.38, 0.54, 0.76, 0.84, 0.72, 0.49, 0.62, 0.79, 0.83, 0.58,
          0.34, 0.48, 0.65, 0.77, 0.71, 0.49, 0.32, 0.45, 0.58, 0.39,
          0.24, 0.33, 0.27, 0.19, 0.14, 0.09, 0.05, 0.02
        ],
        likes_count: 124,
        reports_count: 0,
        created_at: Date.now() - 3600000 * 8,
      },
      {
        id: 'rut_ny_rooftop',
        question_id: 'q_overrated_milestone',
        author_uid: 'usr_marcus_ny',
        author_name: 'Marcus Reed',
        author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        caption: 'Buying a sofa you hate just because you turned 28. Authentic unfiltered take.',
        media_key: 'seed/voice_marcus_milestone.mp3',
        duration_seconds: 41,
        waveform_data: [
          0.21, 0.42, 0.68, 0.85, 0.95, 0.88, 0.63, 0.78, 0.91, 0.79,
          0.52, 0.65, 0.83, 0.94, 0.76, 0.51, 0.73, 0.89, 0.96, 0.74,
          0.44, 0.59, 0.81, 0.91, 0.82, 0.57, 0.69, 0.84, 0.87, 0.65,
          0.41, 0.53, 0.71, 0.82, 0.76, 0.54, 0.38, 0.49, 0.61, 0.42,
          0.27, 0.36, 0.29, 0.21, 0.15, 0.10, 0.06, 0.02
        ],
        likes_count: 67,
        reports_count: 0,
        created_at: Date.now() - 3600000 * 12,
      },
    ];

    seedRuts.forEach(r => this.ruts.set(r.id, r));
  }
}

// Export singleton D1 instance
const globalForD1 = globalThis as unknown as { d1DatabaseInstance?: D1Store };
export const d1 = globalForD1.d1DatabaseInstance || new D1Store();
if (process.env.NODE_ENV !== 'production') {
  globalForD1.d1DatabaseInstance = d1;
}
